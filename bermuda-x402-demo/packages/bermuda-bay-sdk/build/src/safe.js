import { Contract, Interface, ZeroAddress } from 'ethers';
import initMpecdh from './mpecdh.js';
import { hex, poseidon2, queryFilterBatched } from './utils.js';
import { buildSignatureBytes, getSafeTxHash, signSafeTx, isOwner, recoverSigner, encodeMultiSendData, hasDelegateCalls } from './safe-utils.js';
import { SafeTxConfirmationStatus, OperationType } from './types.js';
import SAFE_ABI from './abis/safe.abi.json' with { type: 'json' };
import PROPOSE_TX_LIB_ABI from './abis/proposetxlib.abi.json' with { type: 'json' };
import MULTI_SEND_ABI from './abis/multisend.abi.json' with { type: 'json' };
export default function initSafe(config, registry) {
    const mpecdh = initMpecdh(config);
    const proposeTxLib = new Contract(config.proposeTxLib, PROPOSE_TX_LIB_ABI, {
        provider: config.provider
    });
    return {
        utils: {
            buildSignatureBytes,
            encodeMultiSendData,
            getSafeTxHash,
            signSafeTx,
            isOwner,
            recoverSigner
        },
        mpecdh,
        async shieldedToSafe(_shieldedAddress) {
            try {
                const nativeAddress = registry && typeof registry.ethereumAddressOf === 'function'
                    ? await registry.ethereumAddressOf(_shieldedAddress)
                    : undefined;
                if (!nativeAddress) {
                    return null;
                }
                const safeContract = new Contract(nativeAddress, SAFE_ABI, config.provider);
                await safeContract.getThreshold();
                return nativeAddress;
            }
            catch (error) {
                console.warn('shieldedToSafe: no associated Safe found', error);
                return null;
            }
        },
        challengeHash(params) {
            const safe = BigInt(params.safe);
            const stxHash = BigInt(params.stxHash);
            const hash = poseidon2(safe, stxHash);
            return hex(hash, 32);
        },
        async fetchZkStorageProof(safeAddress, stxHash) {
            // Ensure that the MPT Prover URL ends with a slash so we can use `URL` to
            // construct the full URL properly.
            const mptProverUrl = config.mptProver.endsWith('/')
                ? config.mptProver
                : config.mptProver + '/';
            const baseUrl = new URL(mptProverUrl);
            const url = new URL('proof', baseUrl).toString();
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    chain_id: Number(config.chainId),
                    safe_address: safeAddress,
                    message_hash: stxHash
                })
            });
            const body = (await response.json());
            if (!response.ok) {
                throw new Error(body?.error ?? response.statusText);
            }
            const proof = String(body.proof);
            const challenge = String(body.challenge);
            const blockHash = String(body.block_hash);
            const blockNumber = BigInt(body.block_number);
            const publicInputs = Array.isArray(body.public_inputs)
                ? body.public_inputs.map((pi) => String(pi))
                : [];
            return {
                proof,
                publicInputs,
                challenge,
                blockNumber,
                blockHash
            };
        },
        /**
         * Lists all txs for given Safe including pending (not executed), and
         * unconfirmed ones (not confirmed by given Safe owner). Unconfirmed txs
         * are only listed if a Safe owner address is provided.
         *
         * @param safe Safe address
         * @param owner Optional Safe owner address
         * @param fromBlock Optional block number to start querying from
         * @returns Grouped lists of Safe tx info
         */
        async listTxs(safe, owner, fromBlock) {
            const safeContract = new Contract(safe, SAFE_ABI, { provider: config.provider });
            const threshold = await safeContract.getThreshold().then(Number);
            const toBlock = await config.provider.getBlockNumber().then(BigInt);
            const proposedEvents = await queryFilterBatched(fromBlock || config.startBlock, toBlock, proposeTxLib, proposeTxLib.filters.Proposed(safe, null, null, null));
            const all = await Promise.all(proposedEvents.map(async (e) => {
                const sigs = await proposeTxLib
                    .signatures(e.args.safeTxHash)
                    // Split concatenated signatures into 65-byte chunks
                    .then(sigs => sigs
                    .replace('0x', '')
                    .match(/.{1,130}/g)
                    ?.map(s => `0x${s}`) || []);
                // Restructure the signatures to an object while deriving the signers
                const signatures = sigs.reduce((acc, sig) => {
                    const signer = recoverSigner(e.args.safeTxHash, sig);
                    acc[signer] = sig;
                    return acc;
                }, {});
                const confirmationStatus = sigs.length >= threshold
                    ? SafeTxConfirmationStatus.Ready
                    : sigs.length === threshold - 1
                        ? SafeTxConfirmationStatus.AlmostReady
                        : SafeTxConfirmationStatus.Pending;
                const executionSuccessEvents = await queryFilterBatched(fromBlock || config.startBlock, toBlock, safeContract, safeContract.filters.ExecutionSuccess(e.args.safeTxHash, null));
                return {
                    hash: e.args.safeTxHash,
                    details: e.args.safeTx,
                    confirmationStatus,
                    signatures,
                    executed: executionSuccessEvents.length === 1 ? true : false,
                    txHash: e.transactionHash
                };
            }));
            const pending = all.filter(info => !info.executed);
            let unconfirmed;
            if (owner) {
                unconfirmed = await Promise.all(pending.map(async (info) => {
                    const confirmed = await proposeTxLib.confirmations(info.hash, owner.toLowerCase());
                    return confirmed ? null : info;
                })).then(unconfirmed => unconfirmed.filter(Boolean));
            }
            return { all, pending, unconfirmed };
        },
        /**
         * Assembles `ProposeTxLib.propose` calldata with the given raw Safe tx.
         *
         * The call is done via Safe's MultiSend helper contract.
         *
         * Anyone can propose Safe transactions, if an owner signer is provided
         * the inital confirming signature is generated.
         *
         * @param safe Safe address
         * @param safeTxs Transactions to multisend
         * @param owner Optional Safe owner signer
         * @returns `ProposeTxLib.propose` calldata
         */
        async proposeBatchPayload(safe, safeTxs, owner) {
            if (safeTxs.length === 0)
                throw Error('No transactions');
            if (safeTxs.length === 1) {
                return this.proposePayload(safe, safeTxs[0], owner);
            }
            // MultiSendCallOnly can be used if all of the sub txs in the multiSend
            // invocation are just calls. This just serves as an security assurance
            // for certain use cases as delegatecalls can be exploited as attack
            // vectors if targeting unknown contracts blindly.
            const to = hasDelegateCalls(safeTxs) ? config.multiSend : config.multiSendCallOnly;
            // Encoded transactions. Each transaction is encoded as a packed bytes of:
            //   1. _operation_ as a {uint8}, 0 for a `CALL` or 1 for a `DELEGATECALL` (=> 1 byte),
            //   2. _to_ as an {address} (=> 20 bytes),
            //   3. _value_ as a {uint256} (=> 32 bytes),
            //   4. _data_ length as a {uint256} (=> 32 bytes),
            //   5. _data_ as {bytes}.
            const multiSendData = encodeMultiSendData(safeTxs);
            const data = Interface.from(MULTI_SEND_ABI).encodeFunctionData('multiSend', [multiSendData]);
            // The MultiSend contracts are "libraries", i.e. contracts that provide
            // additional code in the form of functions. To preserve msg.value and
            // msg.sender the MultiSend contracts must be delegatecalled.
            const operation = OperationType.DelegateCall;
            // The outer Safe tx that delegatecalls into MultiSend to execute all txs
            const multiSendTx = { to, data, operation };
            return this.proposePayload(safe, multiSendTx, owner);
        },
        /**
         * Assembles `ProposeTxLib.propose` calldata with the given raw Safe tx.
         *
         * Anyone can propose Safe transactions, if an owner signer is provided
         * the inital confirming signature is generated.
         *
         * @param safe Safe address
         * @param safeTx Raw Safe tx details
         * @param owner Optional Safe owner signer
         * @returns `ProposeTxLib.propose` calldata
         */
        async proposePayload(safe, safeTx, owner) {
            const safeContract = new Contract(safe, SAFE_ABI, { provider: config.provider });
            const nonce = await safeContract.nonce();
            const ownerAdrs = await owner?.getAddress().then(a => a.toLowerCase());
            const isSafeOwner = await isOwner(safeContract, ownerAdrs);
            // Assemble raw safeTx
            if (!safeTx.to)
                throw Error('Missing safeTx.to');
            if (!safeTx.data)
                throw Error('Missing safeTx.data');
            const tx = {
                value: 0n,
                operation: OperationType.Call,
                safeTxGas: 0n,
                baseGas: 0n,
                gasPrice: 0n,
                gasToken: ZeroAddress,
                refundReceiver: ZeroAddress,
                nonce,
                ...safeTx
            };
            // Calculate safeTxHash with the raw safeTx
            const safeTxHash = await safeContract.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce);
            // If the signer is a Safe owner sign the safeTxHash
            let signature = '0x';
            if (owner && !isSafeOwner) {
                throw Error('Not owner');
            }
            else if (owner && isSafeOwner) {
                const chainId = BigInt(config.chainId);
                signature = await signSafeTx(owner, await safeContract.getAddress(), tx, chainId);
            }
            // Assemble the ProposeTxLib.propose calldata
            const to = await proposeTxLib.getAddress();
            const data = proposeTxLib.interface.encodeFunctionData('propose', [safe, tx, signature]);
            return { to, data };
        },
        /**
         * Assembles `ProposeTxLib.confirm` calldata for given Safe tx.
         *
         * @param safe Safe address
         * @param safeTxHash Safe tx hash
         * @param owner Safe owner signer
         * @returns `ProposeTxLib.confirm` calldata
         */
        async confirmPayload(safe, safeTxHash, owner) {
            const safeContract = new Contract(safe, SAFE_ABI, { provider: config.provider });
            const signerAdrs = await owner?.getAddress().then(a => a.toLowerCase());
            const isSafeOwner = await isOwner(safeContract, signerAdrs);
            if (!isSafeOwner)
                throw Error('Not owner');
            // Get Safe tx preimage from Proposed event
            const toBlock = await config.provider.getBlockNumber().then(BigInt);
            const proposedEvents = await queryFilterBatched(config.startBlock, toBlock, proposeTxLib, proposeTxLib.filters.Proposed(safe, safeTxHash, null, null));
            if (proposedEvents.length !== 1)
                throw Error(`Can't find Safe tx ${safe}::${safeTxHash}`);
            const tx = proposedEvents[0].args.safeTx.toObject();
            // Recalculate safeTxHash with preimage and assert it matches
            const txHash = await safeContract.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce);
            if (txHash !== safeTxHash)
                throw Error('Safe tx hash mismatch');
            // Sign the safeTxHash
            const chainId = BigInt(config.chainId);
            const signature = await signSafeTx(owner, await safeContract.getAddress(), tx, chainId);
            // Assemble the ProposeTxLib.confirm calldata
            const to = await proposeTxLib.getAddress();
            const data = proposeTxLib.interface.encodeFunctionData('confirm', [
                safe,
                safeTxHash,
                signature
            ]);
            return { to, data };
        },
        /**
         * Assembles `Safe.executeTransaction` calldata for given Safe tx.
         *
         * If a Safe owner signer is provided and the tx is lacking exactly one
         * confirming signature, then the Safe tx hash is signed and the resulting
         * signature added to the payload.
         *
         * @param safe Safe address
         * @param safeTxHash Safe tx hash
         * @param owner Optional Safe owner signer
         * @returns `Safe.executeTransaction` calldata
         */
        async executePayload(safe, safeTxHash, owner) {
            const safeContract = new Contract(safe, SAFE_ABI, { provider: config.provider });
            const threshold = await safeContract.getThreshold().then(Number);
            // Get Safe tx preimage from Proposed event
            const toBlock = await config.provider.getBlockNumber().then(BigInt);
            const proposedEvents = await queryFilterBatched(config.startBlock, toBlock, proposeTxLib, proposeTxLib.filters.Proposed(safe, safeTxHash, null, null));
            if (proposedEvents.length !== 1)
                throw Error(`Can't find Safe tx ${safe}::${safeTxHash}`);
            const tx = proposedEvents[0].args.safeTx.toObject();
            // Get sigs from storage
            // let sigs = await proposeTxLib.signatures(safeTxHash)
            const sigs = await proposeTxLib
                .signatures(safeTxHash)
                // Split concatenated signatures into 65-byte chunks
                .then(sigs => sigs
                .replace('0x', '')
                .match(/.{1,130}/g)
                ?.map(s => `0x${s}`) || []);
            // const sigCount = sigs.replace('0x', '').length / 130
            // Restructure the signatures to an object while deriving the signers
            const signaturesMap = sigs.reduce((acc, sig) => {
                const signer = recoverSigner(safeTxHash, sig);
                acc[signer] = sig;
                return acc;
            }, {});
            if (owner && sigs.length === threshold - 1) {
                // Sign the safeTxHash
                const chainId = BigInt(config.chainId);
                const signature = await signSafeTx(owner, await safeContract.getAddress(), tx, chainId);
                const ownerAdrs = await owner.getAddress();
                signaturesMap[ownerAdrs] = signature;
            }
            else if (sigs.length < threshold) {
                throw Error('Not yet executable');
            }
            // The encoded signatures must be sorted asc by signer address
            const signatures = buildSignatureBytes(Object.entries(signaturesMap).map(([signer, sig]) => ({ signer, data: sig })));
            // Assemble Safe.execTransaction calldata
            const to = safe;
            const data = safeContract.interface.encodeFunctionData('execTransaction', [
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.safeTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                signatures
            ]);
            return { to, data };
        }
    };
}
//# sourceMappingURL=safe.js.map