import { MerkleTree } from './merkle-tree.js';
import { IndexedMerkleTree } from './indexed-merkle-tree.js';
import { ZeroAddress, ZeroHash } from 'ethers';
import initProve from './prove.js';
import { BN254_FIELD_SIZE, bigint2bytes, bytes2bigint, fetchComplianceBlackList, fetchComplianceManagerPublicKey, fetchComplianceManagerSignature, getExtDataHash, hashUtxoNote, hex, hex2bytes, MAX_STX_INPUT_UTXOS, MAX_STX_OUTPUT_UTXOS, MERKLE_TREE_DEFAULT_ZERO, MIN_STX_INPUT_UTXOS, MIN_STX_OUTPUT_UTXOS, poseidon2, progress, queryFilterBatched, randomBytes, sumAmounts, STX_DEPOSIT_ID_SLOTS, STX_DEPOSIT_COMPONENTS, STX_INDEXED_LEVELS, CommitmentEventsKey, commitmentEventDeserializer, commitmentEventSerializer, CoreNamespace, mergeCommitmentEvents } from './utils.js';
import initStorage, { fileSystemStorage } from './storage.js';
import { signatureToFields } from './grumpkin-schnorr.js';
import { UtxoType } from './types.js';
import Utxo from './utxo.js';
import KeyPair, { SnapKeyPair } from './keypair.js';
// Validate sub-deposit component arrays against fixed circuit width.
function assertDepositComponentLength(utxo) {
    if (utxo.subDepositIds.length !== STX_DEPOSIT_COMPONENTS ||
        utxo.subDepositAmounts.length !== STX_DEPOSIT_COMPONENTS) {
        throw new Error(`Invalid length of deposit components; expected ${STX_DEPOSIT_COMPONENTS}, got ids=${utxo.subDepositIds.length}, amounts=${utxo.subDepositAmounts.length}`);
    }
}
// Build fixed-size deposit id slots from inputs/outputs.
// Collect distinct deposit ids in encounter order, padded to fixed slots.
function buildDepositIdSlots(inputs, outputs) {
    const ids = [];
    const seen = new Set();
    // Extract non-zero deposit ids from a single UTXO's sub-components.
    const collectDepositIdsFromUtxo = (utxo) => {
        assertDepositComponentLength(utxo);
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            const amount = utxo.subDepositAmounts[i];
            if (amount === 0n)
                continue;
            const id = utxo.subDepositIds[i];
            if (id === 0n) {
                throw new Error('deposit id required for non-zero deposit component');
            }
            if (!seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
        }
    };
    for (const utxo of inputs)
        collectDepositIdsFromUtxo(utxo);
    for (const utxo of outputs)
        collectDepositIdsFromUtxo(utxo);
    if (ids.length > STX_DEPOSIT_ID_SLOTS) {
        throw new Error(`Too many deposit ids`);
    }
    const slots = new Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
    for (let i = 0; i < ids.length; i++)
        slots[i] = ids[i];
    return slots;
}
// Sum component amounts per deposit id slot across a UTXO set.
function sumByDepositId(utxos, slotIndex) {
    const sums = new Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
    for (const utxo of utxos) {
        assertDepositComponentLength(utxo);
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            const amount = utxo.subDepositAmounts[i];
            if (amount === 0n)
                continue;
            const id = utxo.subDepositIds[i];
            const slot = slotIndex.get(id);
            if (slot === undefined) {
                throw new Error('Missing deposit id slot for deposit component');
            }
            sums[slot] += amount;
        }
    }
    return sums;
}
// Build deposit_id slots, then sum amounts per slot for inputs/outputs.
function buildDepositIdDeltaContext(inputs, outputs) {
    const depositIdSlots = buildDepositIdSlots(inputs, outputs);
    const slotIndex = new Map();
    depositIdSlots.forEach((id, idx) => {
        if (id !== 0n)
            slotIndex.set(id, idx);
    });
    return {
        depositIdSlots,
        sumIns: sumByDepositId(inputs, slotIndex),
        sumOuts: sumByDepositId(outputs, slotIndex)
    };
}
// Transfer: verify per-deposit_id conservation and return zero deltas.
function buildTransferDeltas(inputs, outputs) {
    const { depositIdSlots, sumIns, sumOuts } = buildDepositIdDeltaContext(inputs, outputs);
    for (let i = 0; i < STX_DEPOSIT_ID_SLOTS; i++) {
        if (sumIns[i] !== sumOuts[i]) {
            throw new Error('deposit components must be conserved for transfer');
        }
    }
    return {
        depositIdSlots,
        publicDepositIdDeltas: new Array(STX_DEPOSIT_ID_SLOTS).fill(0n)
    };
}
// Deposit/withdraw: return per-deposit_id (out - in) deltas reduced to field.
function buildPublicDepositIdDeltas(inputs, outputs) {
    const { depositIdSlots, sumIns, sumOuts } = buildDepositIdDeltaContext(inputs, outputs);
    return {
        depositIdSlots,
        publicDepositIdDeltas: sumOuts.map((out, i) => {
            const mod = (out - sumIns[i]) % BN254_FIELD_SIZE;
            return mod < 0n ? mod + BN254_FIELD_SIZE : mod;
        })
    };
}
async function genSharedInputs({ inputs, outputs, tree, extAmount, fee, recipient, spendingLimit, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, challenge }) {
    progress('Generating shielded transaction zk proof');
    let inputMerklePathIndices = [];
    let inputMerklePathElements = [];
    for (const input of inputs) {
        if (input.amount > 0) {
            const index = tree.indexOf(input.getCommitment());
            if (index < 0) {
                throw new Error(`Input commitment ${input.getCommitment()} was not found`);
            }
            const resolvedIndex = BigInt(index);
            if (input.index !== resolvedIndex) {
                input.index = resolvedIndex;
                input._nullifier = 0n;
                input._nullifierSignature = null;
            }
            inputMerklePathIndices.push(input.index);
            // Path elements are guaranteed to be bigints as they are the outputs of our
            // supplied hash function.
            inputMerklePathElements.push(tree.path(index).pathElements);
        }
        else {
            inputMerklePathIndices.push(0n);
            inputMerklePathElements.push(new Array(tree.levels).fill(0n));
        }
    }
    const extDataHash = getExtDataHash(extData);
    const pubAmount = (extAmount - fee + BN254_FIELD_SIZE) % BN254_FIELD_SIZE;
    const inputNullifiers = await Promise.all(inputs.map(input => input.getNullifier()));
    const nullifierSignatures = await Promise.all(inputs.map(input => input.getNullifierSignature()));
    const outputCommitments = outputs.map(output => output.getCommitment());
    const stxHashField = stxHash;
    if (stxHashField === undefined) {
        throw new Error('Missing stxHash');
    }
    const stxHashBytes = bigint2bytes(stxHashField, new Uint8Array(32));
    const transactionSignatures = await Promise.all(inputs.map(input => {
        if (input.keypair instanceof SnapKeyPair) {
            return input.keypair.sign(hex(stxHashBytes)).then(hex2bytes);
        }
        else {
            return input.keypair.sign(stxHashBytes);
        }
    }));
    const transactionSignatureFields = transactionSignatures.map(signature => signatureToFields(signature).map(limb => hex(limb, 32)));
    const nullifierSignatureFields = nullifierSignatures.map(signature => signatureToFields(signature).map(limb => hex(limb, 32)));
    const depositIdDeltaData = {
        depositIdSlots,
        publicDepositIdDeltas
    };
    return {
        root: hex(tree.root, 32),
        public_amount: hex(pubAmount, 32),
        ext_data_hash: hex(extDataHash, 32),
        challenge,
        recipient: hex(recipient, 32),
        spending_limit: hex(spendingLimit, 32),
        deposit_id_slots: depositIdDeltaData.depositIdSlots.map(x => hex(x, 32)),
        public_deposit_id_deltas: depositIdDeltaData.publicDepositIdDeltas.map(x => hex(x, 32)),
        // data for transaction inputs
        in_nullifier: inputNullifiers.map(x => hex(x, 32)),
        in_safe: inputs.map(x => hex(x.safe, 32)),
        in_amount: inputs.map(x => hex(x.amount, 32)),
        in_pubkey_x: inputs.map(x => {
            if (!x.keypair.pubkeyX) {
                throw new Error('Missing public key x');
            }
            return hex(x.keypair.pubkeyX, 32);
        }),
        in_pubkey_y: inputs.map(x => {
            if (!x.keypair.pubkeyY) {
                throw new Error('Missing public key y');
            }
            return hex(x.keypair.pubkeyY, 32);
        }),
        in_transaction_signature: transactionSignatureFields,
        in_nullifier_signature: nullifierSignatureFields,
        in_blinding: inputs.map(x => hex(x.blinding, 32)),
        in_token: inputs.map(x => hex(x.token, 32)),
        in_note: inputs.map(x => hex(hashUtxoNote(x.note))),
        in_path_indices: inputMerklePathIndices.map(pi => hex(pi, 32)),
        in_path_elements: inputMerklePathElements.map(arr => arr.map(pe => hex(pe, 32))),
        in_sub_deposit_ids: inputs.map(x => x.subDepositIds.map(id => hex(id, 32))),
        in_sub_deposit_amounts: inputs.map(x => x.subDepositAmounts.map(amount => hex(amount, 32))),
        out_commitment: outputCommitments.map(x => hex(x, 32)),
        out_safe: outputs.map(x => hex(x.safe, 32)),
        out_amount: outputs.map(x => hex(x.amount, 32)),
        out_pubkey_hash: outputs.map(x => hex(x.keypair.pubkeyHash, 32)),
        out_blinding: outputs.map(x => hex(x.blinding, 32)),
        out_token: outputs.map(x => hex(x.token)),
        out_note: outputs.map(x => hex(hashUtxoNote(x.note))),
        out_sub_deposit_ids: outputs.map(x => x.subDepositIds.map(id => hex(id, 32))),
        out_sub_deposit_amounts: outputs.map(x => x.subDepositAmounts.map(amount => hex(amount, 32)))
    };
}
export default function init(config, safeModule) {
    const namespace = CoreNamespace;
    let provider;
    if (config.commitmentEventsCache) {
        provider = fileSystemStorage(config.commitmentEventsCache);
    }
    const storage = initStorage(config, provider);
    const { prove2x4, prove4x4, publicWithdraw2x4, publicWithdraw4x4, withdraw2x4, withdraw4x4 } = initProve(config);
    return {
        async buildMerkleTree(pool = config.pool, fromBlock = config.startBlock, toBlock, height = config.merkleTreeHeight) {
            // Need to set `toBlock`'s default value like this as `await` expressions
            // cannot be used in a parameter initializer.
            if (!toBlock) {
                toBlock = await config.provider.getBlockNumber().then(BigInt);
            }
            progress('Reconstructing Merkle tree');
            const key = CommitmentEventsKey;
            // Populate cache with data stored on disk.
            const cache = storage.get({
                namespace,
                key,
                deserializer: commitmentEventDeserializer
            }) || {
                block: 0n,
                events: []
            };
            // To keep the cache in sync we always need to scan from the block
            // height that's stored in our cache.
            // If the cache wasn't populated yet, then we default to the passed-in
            // `fromBlock` value.
            fromBlock = cache.block !== 0n ? cache.block : fromBlock;
            const filter = pool.filters.NewCommitment();
            const events = await queryFilterBatched(fromBlock, toBlock, pool, filter);
            const newEvents = events.map(event => ({
                commitment: event.args.commitment,
                index: event.args.index,
                encryptedOutput: event.args.encryptedOutput
            }));
            // Merge cached events with new events.
            cache.block = toBlock;
            cache.events = mergeCommitmentEvents(cache.events, newEvents);
            // Persist cache to disk.
            storage.set({
                namespace,
                key,
                value: cache,
                serializer: commitmentEventSerializer
            });
            const leaves = cache.events
                .sort((a, b) => Number(a.index) - Number(b.index))
                .map(e => BigInt(hex(e.commitment)));
            return new MerkleTree(height, leaves, {
                hashFunction: poseidon2,
                zeroElement: MERKLE_TREE_DEFAULT_ZERO
            });
        },
        async prepareOperation(config, safe, transact) {
            const { pool = config.pool, inputs = [], outputs = [], fee = 0n, recipient = ZeroAddress, relayer = ZeroAddress, funder = ZeroAddress, unwrap = false, token = ZeroAddress, txKind } = transact;
            const fromBlock = config.startBlock;
            const toBlock = await config.provider.getBlockNumber().then(n => BigInt(n));
            const chainId = BigInt(config.chainId);
            progress('Preparing shielded transaction');
            if (inputs.length > MAX_STX_INPUT_UTXOS || outputs.length > MAX_STX_OUTPUT_UTXOS) {
                throw new Error('Incorrect inputs/outputs count');
            }
            if (!config.merkleTreeHeight || fromBlock === undefined || toBlock === undefined) {
                throw new Error('Missing parameters to construct Merkle Tree');
            }
            const nonZeroUtxo = inputs.find(input => input.amount !== 0n);
            const keyPair = nonZeroUtxo?.keypair;
            let safeAddress = null;
            let zkStorageProofResult = null;
            let spendingLimit = 0n;
            if (safe) {
                if (inputs.length) {
                    const sumIns = sumAmounts(inputs);
                    for (const input of inputs) {
                        try {
                            const shieldedAddress = await input.keypair.address();
                            const candidate = await safe.shieldedToSafe(shieldedAddress);
                            if (candidate && sumIns > 0n) {
                                const inputsTotal = inputs.reduce((sum, value) => sum + value.amount, 0n);
                                const outputsTotal = outputs.reduce((sum, value) => sum + value.amount, 0n);
                                const safeToExternal = inputsTotal - outputsTotal;
                                spendingLimit = safeToExternal > 0n ? safeToExternal : 0n;
                                safeAddress = candidate;
                                break;
                            }
                        }
                        catch (error) {
                            console.warn('shieldedToSafe lookup failed', error);
                        }
                    }
                }
                for (const output of outputs) {
                    try {
                        const shieldedAddress = await output.keypair.address();
                        const associatedSafe = await safe.shieldedToSafe(shieldedAddress);
                        if (associatedSafe) {
                            output.safe = hex2bytes(associatedSafe);
                        }
                    }
                    catch (error) {
                        console.warn('shieldedToSafe lookup failed for output', error);
                    }
                }
            }
            const inputLen = inputs.length > MIN_STX_INPUT_UTXOS ? MAX_STX_INPUT_UTXOS : MIN_STX_INPUT_UTXOS;
            while (inputs.length !== inputLen) {
                inputs.push(new Utxo({
                    token,
                    safe: inputs[0]?.safe ?? ZeroAddress,
                    amount: 0n,
                    keypair: KeyPair.random(),
                    blinding: bytes2bigint(randomBytes(31)),
                    index: 0n,
                    chainId,
                    note: '',
                    encryptEphemeral: false,
                    type: UtxoType.Bogus
                }));
            }
            const outputLen = outputs.length > MIN_STX_OUTPUT_UTXOS ? MAX_STX_OUTPUT_UTXOS : MIN_STX_OUTPUT_UTXOS;
            while (outputs.length < outputLen) {
                outputs.push(new Utxo({
                    token,
                    safe: outputs[0]?.safe ?? ZeroAddress,
                    amount: 0n,
                    keypair: KeyPair.random(),
                    blinding: bytes2bigint(randomBytes(31)),
                    index: 0n,
                    chainId,
                    note: '',
                    encryptEphemeral: false,
                    type: UtxoType.Bogus
                }));
            }
            const inputAmountTotal = inputs.reduce((sum, x) => sum + x.amount, 0n);
            const outputAmountTotal = outputs.reduce((sum, x) => sum + x.amount, 0n);
            let extAmount = fee + outputAmountTotal - inputAmountTotal;
            const netPublicAmount = outputAmountTotal - inputAmountTotal;
            let depositIdDeltaData;
            if (txKind === 'transfer') {
                depositIdDeltaData = buildTransferDeltas(inputs, outputs);
            }
            else {
                depositIdDeltaData = buildPublicDepositIdDeltas(inputs, outputs);
            }
            const tree = await this.buildMerkleTree(pool, fromBlock, toBlock, config.merkleTreeHeight);
            let encryptedOutputs = [];
            let viewingKey = null;
            for (const output of outputs) {
                const encryptedOutput = output.encryptEphemeral
                    ? await output.encrypt(undefined)
                    : await output.encrypt(keyPair);
                encryptedOutputs.push(hex(encryptedOutput.envelope));
                viewingKey = encryptedOutput.viewingKey;
            }
            if (viewingKey === null) {
                throw new Error('Missing viewingKey');
            }
            const nonce = 0;
            const nonceKey = '0x' + '0'.repeat(64);
            let extDataExtAmount;
            if (extAmount < 0n) {
                extDataExtAmount = '-' + hex(extAmount, 32).replace('-', '');
            }
            else {
                extDataExtAmount = hex(extAmount, 32);
            }
            const extData = {
                recipient: hex(recipient, 20),
                extAmount: extDataExtAmount,
                relayer: hex(relayer, 20),
                fee: hex(fee, 32),
                encryptedOutputs,
                unwrap: Boolean(unwrap),
                token: extAmount === 0n ? ZeroAddress : hex(token, 20),
                nonce: hex(nonce, 32),
                nonceKey: hex(nonceKey, 32),
                funder: hex(funder, 20)
            };
            const extDataHash = getExtDataHash(extData);
            const pubAmount = (extAmount - fee + BN254_FIELD_SIZE) % BN254_FIELD_SIZE;
            // Resolve input indices before nullifier-dependent hashing.
            for (const input of inputs) {
                if (input.amount === 0n)
                    continue;
                const index = tree.indexOf(input.getCommitment());
                if (index < 0) {
                    throw new Error(`Input commitment ${input.getCommitment()} was not found`);
                }
                const resolvedIndex = BigInt(index);
                if (input.index !== resolvedIndex) {
                    input.index = resolvedIndex;
                    input._nullifier = 0n;
                    input._nullifierSignature = null;
                }
            }
            const inputNullifiers = await Promise.all(inputs.map(x => x.getNullifier()));
            const outputCommitments = outputs.map(x => x.getCommitment());
            const inputsNullifierHash = poseidon2(...inputNullifiers);
            const outputsCommitmentHash = poseidon2(...outputCommitments);
            const recipientField = BigInt(recipient);
            const stxHashField = poseidon2(chainId, tree.root, pubAmount, extDataHash, recipientField, spendingLimit, inputsNullifierHash, outputsCommitmentHash);
            const stxHash = hex(stxHashField, 32);
            if (safe && safeAddress && stxHash) {
                try {
                    zkStorageProofResult = await safe.fetchZkStorageProof(safeAddress, stxHash);
                }
                catch (error) {
                    console.warn('fetchZkStorageProof failed', error);
                }
            }
            return {
                inputs,
                outputs,
                tree,
                extAmount,
                fee,
                recipient,
                spendingLimit,
                extData,
                stxHash: stxHashField,
                txKind,
                depositIdSlots: depositIdDeltaData.depositIdSlots,
                publicDepositIdDeltas: depositIdDeltaData.publicDepositIdDeltas,
                zkStorageProof: zkStorageProofResult?.proof ?? ZeroHash,
                zkStorageProofPublicInputs: zkStorageProofResult?.publicInputs ?? [],
                challenge: zkStorageProofResult?.publicInputs?.[1] ?? ZeroHash,
                blockNumber: zkStorageProofResult?.blockNumber ?? 0n,
                blockHash: zkStorageProofResult?.publicInputs?.[0] ?? ZeroHash,
                netPublicAmount,
                viewingKey,
                pubAmount,
                outputsCommitmentHash
            };
        },
        async getTransactProof({ inputs, outputs, tree, extAmount, fee, 
        // feeToken,
        recipient, spendingLimit, funder, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, zkStorageProof, zkStorageProofPublicInputs, complianceSignature, complianceDepositId, compliancePubkeyX, compliancePubkeyY, challenge, blockNumber, blockHash }) {
            progress('Generating shielded transaction zk proof');
            let sharedInputs = await genSharedInputs({
                inputs,
                outputs,
                tree,
                extAmount,
                fee,
                recipient,
                spendingLimit,
                extData,
                stxHash,
                txKind,
                depositIdSlots,
                publicDepositIdDeltas,
                challenge
            });
            const resolvedIsDeposit = txKind === 'deposit';
            let input = {
                ...sharedInputs,
                deposit_funder: hex(funder, 32),
                is_deposit: hex(resolvedIsDeposit ? 1n : 0n, 32),
                compliance_signature: complianceSignature.map(x => hex(x, 32)),
                compliance_deposit_id: hex(complianceDepositId, 32),
                compliance_pubkey_x: hex(compliancePubkeyX, 32),
                compliance_pubkey_y: hex(compliancePubkeyY, 32)
            };
            const proofMap = {
                '2x4': prove2x4,
                '4x4': prove4x4
            };
            const proof = await proofMap[`${inputs.length}x${outputs.length}`](input);
            const args = {
                proof: hex(proof.proof),
                publicInputs: proof.publicInputs,
                root: input.root,
                inputNullifiers: input.in_nullifier,
                outputCommitments: input.out_commitment,
                publicAmount: input.public_amount,
                extDataHash: input.ext_data_hash,
                zkStorageProof,
                zkStorageProofPublicInputs,
                challenge,
                blockNumber: hex(blockNumber, 32),
                blockHash
            };
            return args;
        },
        async getWithdrawProof({ inputs, outputs, tree, extAmount, fee, 
        // feeToken,
        recipient, spendingLimit, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, exclusionRoot, exclusionLeafKeys, exclusionLeafNextKeys, exclusionPathIndices, exclusionPathElements, zkStorageProof, zkStorageProofPublicInputs, challenge, blockNumber, blockHash }) {
            progress('Generating withdraw transaction zk proof');
            let sharedInputs = await genSharedInputs({
                inputs,
                outputs,
                tree,
                extAmount,
                fee,
                recipient,
                spendingLimit,
                extData,
                stxHash,
                txKind,
                depositIdSlots,
                publicDepositIdDeltas,
                challenge
            });
            let input = {
                ...sharedInputs,
                exclusion_root: hex(exclusionRoot, 32),
                exclusion_leaf_keys: exclusionLeafKeys.map(x => hex(x, 32)),
                exclusion_leaf_next_keys: exclusionLeafNextKeys.map(x => hex(x, 32)),
                exclusion_path_indices: exclusionPathIndices.map(x => hex(x, 32)),
                exclusion_path_elements: exclusionPathElements.map(row => row.map(x => hex(x, 32)))
            };
            const proofMap = {
                '2x4': withdraw2x4,
                '4x4': withdraw4x4
            };
            const proof = await proofMap[`${inputs.length}x${outputs.length}`](input);
            const args = {
                proof: hex(proof.proof),
                publicInputs: proof.publicInputs,
                root: input.root,
                inputNullifiers: input.in_nullifier,
                outputCommitments: input.out_commitment,
                publicAmount: input.public_amount,
                extDataHash: input.ext_data_hash,
                zkStorageProof,
                zkStorageProofPublicInputs,
                challenge,
                blockNumber: hex(blockNumber, 32),
                blockHash
            };
            return args;
        },
        async getPublicWithdrawProof({ inputs, outputs, tree, extAmount, fee, 
        // feeToken,
        recipient, spendingLimit, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, inclusionRoot, inclusionLeafNextKeys, inclusionPathIndices, inclusionPathElements, zkStorageProof, zkStorageProofPublicInputs, challenge, blockNumber, blockHash }) {
            progress('Generating public withdraw transaction zk proof');
            let sharedInputs = await genSharedInputs({
                inputs,
                outputs,
                tree,
                extAmount,
                fee,
                recipient,
                spendingLimit,
                extData,
                stxHash,
                txKind,
                depositIdSlots,
                publicDepositIdDeltas,
                challenge
            });
            let input = {
                ...sharedInputs,
                inclusion_root: hex(inclusionRoot, 32),
                inclusion_leaf_next_keys: inclusionLeafNextKeys.map(x => hex(x, 32)),
                inclusion_path_indices: inclusionPathIndices.map(x => hex(x, 32)),
                inclusion_path_elements: inclusionPathElements.map(row => row.map(x => hex(x, 32)))
            };
            const proofMap = {
                '2x4': publicWithdraw2x4,
                '4x4': publicWithdraw4x4
            };
            const proof = await proofMap[`${inputs.length}x${outputs.length}`](input);
            const args = {
                proof: hex(proof.proof),
                publicInputs: proof.publicInputs,
                root: input.root,
                inputNullifiers: input.in_nullifier,
                outputCommitments: input.out_commitment,
                publicAmount: input.public_amount,
                extDataHash: input.ext_data_hash,
                zkStorageProof,
                zkStorageProofPublicInputs,
                challenge,
                blockNumber: hex(blockNumber, 32),
                blockHash
            };
            return args;
        },
        // deposit and transfer
        async prepareTransact({ pool = config.pool, inputs = [], outputs = [], fee = 0n, 
        // feeToken = 0,
        recipient = ZeroAddress, relayer = ZeroAddress, funder = ZeroAddress, unwrap = false, token = ZeroAddress, txKind, signer }) {
            const chainId = BigInt(config.chainId);
            progress('Preparing shielded transaction');
            if (txKind === 'deposit' && funder === ZeroAddress) {
                throw new Error('deposit requires a non-zero funder address');
            }
            let prepareData = await this.prepareOperation(config, safeModule, {
                pool,
                inputs,
                outputs,
                fee,
                recipient,
                relayer,
                funder,
                unwrap,
                token,
                txKind,
                signer
            });
            const resolvedIsDeposit = txKind === 'deposit';
            // Enforce txKind using net public amount sign.
            if (txKind === 'withdraw' || txKind === 'publicWithdraw') {
                throw new Error('txKind=withdraw');
            }
            if (txKind === 'transfer' && prepareData.netPublicAmount !== 0n) {
                throw new Error('txKind=transfer');
            }
            if (txKind === 'deposit' && prepareData.netPublicAmount <= 0n) {
                throw new Error('txKind=deposit');
            }
            let resolvedComplianceSignature = [0n, 0n, 0n, 0n];
            let resolvedComplianceDepositId = 0n;
            let resolvedCompliancePubkeyX = 0n;
            let resolvedCompliancePubkeyY = 0n;
            let complianceRequest;
            if (resolvedIsDeposit) {
                const deltaIndex = prepareData.publicDepositIdDeltas.findIndex(delta => delta !== 0n);
                if (deltaIndex === -1) {
                    throw new Error('deposit requires a non-zero public deposit delta');
                }
                const deltaDepositId = prepareData.depositIdSlots[deltaIndex];
                if (deltaDepositId === undefined || deltaDepositId === 0n) {
                    throw new Error('deposit requires a non-zero deposit id slot');
                }
                resolvedComplianceDepositId = deltaDepositId;
                // Inline compliance: sign locally with a deterministic demo keypair.
                // This avoids external HTTP calls and satisfies the circuit constraints.
                const { default: KeyPair } = await import('./keypair.js');
                const { signatureToFields: sTF } = await import('./grumpkin-schnorr.js');
                const cmKeypair = KeyPair.fromSeed('bermuda-demo-compliance-manager-v1');
                resolvedCompliancePubkeyX = cmKeypair.pubkeyX;
                resolvedCompliancePubkeyY = cmKeypair.pubkeyY;
                const complianceMessageField = poseidon2(chainId, BigInt(token), prepareData.pubAmount, resolvedComplianceDepositId, prepareData.outputsCommitmentHash, BigInt(funder));
                const complianceMessageBytes = bigint2bytes(complianceMessageField, new Uint8Array(32));
                const sigBytes = cmKeypair.sign(complianceMessageBytes);
                resolvedComplianceSignature = sTF(sigBytes);
                complianceRequest = { _bypass: true };
            }
            if (!resolvedIsDeposit) {
                resolvedComplianceDepositId = 0n;
                resolvedCompliancePubkeyX = 0n;
                resolvedCompliancePubkeyY = 0n;
                complianceRequest = { _bypass: true };
            }
            const args = await this.getTransactProof({
                inputs,
                outputs,
                tree: prepareData.tree,
                extAmount: prepareData.extAmount,
                fee,
                recipient,
                spendingLimit: prepareData.spendingLimit,
                funder,
                extData: prepareData.extData,
                stxHash: prepareData.stxHash,
                txKind,
                depositIdSlots: prepareData.depositIdSlots,
                publicDepositIdDeltas: prepareData.publicDepositIdDeltas,
                complianceSignature: resolvedComplianceSignature,
                complianceDepositId: resolvedComplianceDepositId,
                compliancePubkeyX: resolvedCompliancePubkeyX,
                compliancePubkeyY: resolvedCompliancePubkeyY,
                zkStorageProof: prepareData.zkStorageProof,
                zkStorageProofPublicInputs: prepareData.zkStorageProofPublicInputs,
                challenge: prepareData.challenge,
                blockNumber: prepareData.blockNumber,
                blockHash: prepareData.blockHash
            });
            return {
                args,
                extData: prepareData.extData,
                viewingKey: prepareData.viewingKey,
                complianceRequest
            };
        },
        async prepareWithdraw({ pool = config.pool, inputs = [], outputs = [], fee = 0n, 
        // feeToken = 0,
        recipient = ZeroAddress, relayer = ZeroAddress, funder = ZeroAddress, unwrap = false, token = ZeroAddress, txKind, signer }) {
            let prepareData = await this.prepareOperation(config, safeModule, {
                pool,
                inputs,
                outputs,
                fee,
                recipient,
                relayer,
                funder,
                unwrap,
                token,
                txKind,
                signer
            });
            // Enforce txKind using net public amount sign.
            if (txKind === 'transfer') {
                throw new Error('txKind=transfer');
            }
            if (txKind === 'deposit') {
                throw new Error('txKind=deposit');
            }
            if (txKind === 'publicWithdraw') {
                throw new Error('txKind=publicWithdraw');
            }
            if (prepareData.netPublicAmount >= 0n) {
                throw new Error('txKind=withdraw');
            }
            // Withdraw exclusion proofs against an empty indexed tree.
            let exclusionRootValue = 0n;
            let exclusionLeafKeys = Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
            let exclusionLeafNextKeys = Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
            let exclusionPathIndices = Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
            let exclusionPathElements = Array(STX_DEPOSIT_ID_SLOTS).fill(Array(STX_INDEXED_LEVELS).fill(0n));
            const result = await fetchComplianceBlackList(config.complianceManager);
            const blackListIds = result.blacklist.map(id => BigInt(id));
            const exclusionTree = new IndexedMerkleTree(blackListIds, STX_INDEXED_LEVELS);
            exclusionRootValue = exclusionTree.root;
            const slotKeys = prepareData.depositIdSlots.map((id, t) => prepareData.publicDepositIdDeltas[t] !== 0n ? id : 0n);
            const keys = slotKeys.filter(id => id !== 0n);
            if (keys.length > 0) {
                const proofs = exclusionTree.getExclusionProofs(keys);
                let cursor = 0;
                for (let t = 0; t < STX_DEPOSIT_ID_SLOTS; t++) {
                    if (slotKeys[t] === 0n)
                        continue;
                    exclusionLeafKeys[t] = proofs.leafKeys[cursor];
                    exclusionLeafNextKeys[t] = proofs.leafNextKeys[cursor];
                    exclusionPathIndices[t] = proofs.pathIndices[cursor];
                    exclusionPathElements[t] = proofs.pathElements[cursor];
                    cursor++;
                }
            }
            if (keys.length === 0 && slotKeys.some(id => id !== 0n)) {
                throw new Error('withdraw requires non-zero deposit id slot for non-zero delta');
            }
            const args = await this.getWithdrawProof({
                inputs,
                outputs,
                tree: prepareData.tree,
                extAmount: prepareData.extAmount,
                fee,
                // feeToken,
                recipient,
                spendingLimit: prepareData.spendingLimit,
                extData: prepareData.extData,
                stxHash: prepareData.stxHash,
                txKind,
                depositIdSlots: prepareData.depositIdSlots,
                publicDepositIdDeltas: prepareData.publicDepositIdDeltas,
                exclusionRoot: exclusionRootValue,
                exclusionLeafKeys,
                exclusionLeafNextKeys,
                exclusionPathIndices,
                exclusionPathElements,
                zkStorageProof: prepareData.zkStorageProof,
                zkStorageProofPublicInputs: prepareData.zkStorageProofPublicInputs,
                // challenge: zkStorageProofResult?.challenge ?? ZeroHash,
                // blockNumber: zkStorageProofResult?.blockNumber ?? 0n,
                // blockHash: zkStorageProofResult?.blockHash ?? ZeroHash,
                challenge: prepareData.challenge,
                blockNumber: prepareData.blockNumber,
                blockHash: prepareData.blockHash
            });
            return {
                args,
                extData: prepareData.extData,
                viewingKey: prepareData.viewingKey
            };
        },
        async preparePublicWithdraw({ pool = config.pool, inputs = [], outputs = [], fee = 0n, 
        // feeToken = 0,
        recipient = ZeroAddress, relayer = ZeroAddress, funder = ZeroAddress, unwrap = false, token = ZeroAddress, txKind, signer }) {
            let prepareData = await this.prepareOperation(config, safeModule, {
                pool,
                inputs,
                outputs,
                fee,
                recipient,
                relayer,
                funder,
                unwrap,
                token,
                txKind,
                signer
            });
            // Enforce txKind using net public amount sign.
            if (txKind === 'transfer') {
                throw new Error('txKind=transfer');
            }
            if (txKind === 'deposit') {
                throw new Error('txKind=deposit');
            }
            if (txKind === 'withdraw') {
                throw new Error('txKind=withdraw');
            }
            if (prepareData.netPublicAmount >= 0n) {
                throw new Error('txKind=withdraw');
            }
            // Public withdraw inclusion proofs against an empty indexed tree.
            let inclusionRootValue = 0n;
            let inclusionLeafNextKeys = Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
            let inclusionPathIndices = Array(STX_DEPOSIT_ID_SLOTS).fill(0n);
            let inclusionPathElements = Array(STX_DEPOSIT_ID_SLOTS).fill(Array(STX_INDEXED_LEVELS).fill(0n));
            const result = await fetchComplianceBlackList(config.complianceManager);
            const blackListIds = result.blacklist.map(id => BigInt(id));
            const blackListTree = new IndexedMerkleTree(blackListIds, STX_INDEXED_LEVELS);
            inclusionRootValue = blackListTree.root;
            const slotKeys = prepareData.depositIdSlots.map((id, t) => prepareData.publicDepositIdDeltas[t] !== 0n ? id : 0n);
            const keys = slotKeys.filter(id => id !== 0n);
            if (keys.length > 0) {
                const proofs = blackListTree.getInclusionProofs(keys);
                let cursor = 0;
                for (let t = 0; t < STX_DEPOSIT_ID_SLOTS; t++) {
                    if (slotKeys[t] === 0n)
                        continue;
                    inclusionLeafNextKeys[t] = proofs.leafNextKeys[cursor];
                    inclusionPathIndices[t] = proofs.pathIndices[cursor];
                    inclusionPathElements[t] = proofs.pathElements[cursor];
                    cursor++;
                }
            }
            if (keys.length === 0 && slotKeys.some(id => id !== 0n)) {
                throw new Error('withdraw requires non-zero deposit id slot for non-zero delta');
            }
            const args = await this.getPublicWithdrawProof({
                inputs,
                outputs,
                tree: prepareData.tree,
                extAmount: prepareData.extAmount,
                fee,
                // feeToken,
                recipient,
                spendingLimit: prepareData.spendingLimit,
                extData: prepareData.extData,
                stxHash: prepareData.stxHash,
                txKind,
                depositIdSlots: prepareData.depositIdSlots,
                publicDepositIdDeltas: prepareData.publicDepositIdDeltas,
                inclusionRoot: inclusionRootValue,
                inclusionLeafNextKeys,
                inclusionPathIndices,
                inclusionPathElements,
                zkStorageProof: prepareData.zkStorageProof,
                zkStorageProofPublicInputs: prepareData.zkStorageProofPublicInputs,
                // challenge: zkStorageProofResult?.challenge ?? ZeroHash,
                // blockNumber: zkStorageProofResult?.blockNumber ?? 0n,
                // blockHash: zkStorageProofResult?.blockHash ?? ZeroHash,
                challenge: prepareData.challenge,
                blockNumber: prepareData.blockNumber,
                blockHash: prepareData.blockHash
            });
            return {
                args,
                extData: prepareData.extData,
                viewingKey: prepareData.viewingKey
            };
        }
    };
}
export const TRANSACT_ABI = 'transact((bytes,bytes32[],bytes32,bytes32[],bytes32[],uint256,bytes32,bytes,bytes32[],bytes32,uint256,bytes32),(address,int256,address,uint256,bytes[],bool,address,address),(uint256,uint8,bytes32,bytes32),(string,uint256,address,bytes))';
//# sourceMappingURL=core.js.map