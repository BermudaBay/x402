import { Contract, Interface, Signature } from 'ethers';
import Utxo from './utxo.js';
import { ethers } from 'ethers';
import KeyPair, { SnapKeyPair } from './keypair.js';
import { default as initCore, TRANSACT_ABI } from './core.js';
import initRegistry from './registry.js';
import initFindUtxos from './find-utxos.js';
import initSafe from './safe.js';
import { relay } from './relay.js';
import { mapTransactArgs, encodeInternalTransactData, MAX_STX_OUTPUT_UTXOS, STX_DEPOSIT_COMPONENTS, sortDescByAmount, fetchComplianceBlackList, fetchComplianceCheck, SHIELDED_ADDRESS_PATTERN, permit } from './utils.js';
import { allocateDepositComponents, selectTransferInputCandidates, buildTransferInputsOutputs, subtractStepAmounts, assertTransferBalance, resolveTransferStep, buildWithdrawInputsOutputs, resolveWithdrawStep } from './strategy.js';
import ERC20_ABI from './abis/erc20.abi.json' with { type: 'json' };
import POOL_ABI from './abis/pool.abi.json' with { type: 'json' };
import { UtxoType } from './types.js';
import { zeroHash } from 'viem';
export default function init(config) {
    const chainId = BigInt(config.chainId);
    const futxos = initFindUtxos(config);
    const registry = initRegistry(config);
    const safeModule = initSafe(config, registry);
    const coreModule = initCore(config, safeModule);
    // Assemble proof/payload for given inputs/outputs.
    const proveAndEncodeTransfer = async (inputs, outputs, token) => {
        const artifacts = await coreModule.prepareTransact({
            pool: config.pool,
            inputs,
            outputs,
            token,
            txKind: 'transfer',
            // For shielded transfers relayer fees are paid through an UTXO.
            fee: 0n,
            merkleTreeHeight: config.merkleTreeHeight,
            fromBlock: config.startBlock,
            toBlock: await config.provider.getBlockNumber().then(BigInt),
            safeModule
        });
        const [_args, _extData] = mapTransactArgs([artifacts.args, artifacts.extData]);
        const _permit = [BigInt(0), 0, zeroHash, zeroHash];
        const _attestation = ['', BigInt(0), ethers.ZeroAddress, '0x'];
        const data = Interface.from(POOL_ABI).encodeFunctionData(TRANSACT_ABI, [
            _args,
            _extData,
            _permit,
            _attestation
        ]);
        return {
            chainId: Number(config.chainId),
            to: await config.pool.getAddress(),
            data
        };
    };
    // Assemble proof/payload for given withdraw/publicWithdraw inputs/outputs.
    const proveAndEncodeWithdraw = async (inputs, outputs, isPublic = false, params, options) => {
        const token = params.token.toLowerCase();
        let artifacts;
        if (!isPublic) {
            artifacts = await coreModule.prepareWithdraw({
                pool: config.pool,
                inputs,
                outputs,
                token,
                txKind: 'withdraw',
                recipient: params.to,
                relayer: options?.relayer,
                fee: options?.fee,
                merkleTreeHeight: config.merkleTreeHeight,
                fromBlock: config.startBlock,
                toBlock: await config.provider.getBlockNumber().then(BigInt),
                unwrap: options?.unwrap,
                safeModule
            });
        }
        else {
            artifacts = await coreModule.preparePublicWithdraw({
                pool: config.pool,
                inputs,
                outputs,
                token,
                txKind: 'publicWithdraw',
                recipient: params.to,
                relayer: options?.relayer,
                fee: options?.fee,
                merkleTreeHeight: config.merkleTreeHeight,
                fromBlock: config.startBlock,
                toBlock: await config.provider.getBlockNumber().then(BigInt),
                unwrap: options?.unwrap,
                safeModule
            });
        }
        const [_args, _extData] = mapTransactArgs([artifacts.args, artifacts.extData]);
        const _permit = [BigInt(0), 0, zeroHash, zeroHash];
        const _attestation = ['', BigInt(0), ethers.ZeroAddress, '0x'];
        const data = Interface.from(POOL_ABI).encodeFunctionData(TRANSACT_ABI, [
            _args,
            _extData,
            _permit,
            _attestation
        ]);
        return {
            chainId: Number(config.chainId),
            to: await config.pool.getAddress(),
            data
        };
    };
    const MAX_TRANSFER_CHUNK_STEPS = 32;
    const MAX_WITHDRAW_CHUNK_STEPS = 32;
    return {
        /**
         * Assembles a deposit payload.
         * Multiple deposit recipients can be declared in a single shielded tx.
         *
         * @param signer Any signer
         * @param params.token Token address
         * @param params.recipients[].amount Amount to deposit
         * @param params.recipients[].to Deposit recipient's shielded address
         * @param options.relayer Relayer's native address
         * @param options.fee Relayer fee
         * @param options.permitSeconds Seconds the conditional permit is valid for
         * @returns Transaction payload
         */
        async deposit(params, options) {
            const token = Array.isArray(params)
                ? params[0]?.token.toLowerCase()
                : params.token.toLowerCase();
            // Check that we can fit all recipients (including one self change UTXO).
            // If (shielded) fee and multi recipients is set make sure we can include
            // one output utxo for the relayer.
            if (options?.relayer &&
                (options.relayer?.endsWith('.bay') || SHIELDED_ADDRESS_PATTERN.test(options.relayer))) {
                if (!options?.fee)
                    throw Error('Option relayer requires option fee');
                if (params.recipients.length >= MAX_STX_OUTPUT_UTXOS - 1)
                    throw new Error('Too many recipients');
                params.recipients.push({ amount: options?.fee, to: options.relayer });
            }
            if (params.recipients.some(({ amount }) => amount > 0n) &&
                (!options?.depositId || options.depositId === 0n)) {
                throw new Error('depositId is required for non-zero deposit outputs');
            }
            // Temporary: use the user's keypair until compliance server signing is wired.
            if (params.recipients.some(({ amount }) => amount > 0n) && !options?.userKeyPair) {
                throw new Error('Provide options.userKeyPair for deposit compliance signing');
            }
            // Creating the permit if necessary.
            let owner;
            if (typeof params.signer['getAddress'] === 'function') {
                // ethers
                owner = await params.signer['getAddress']();
            }
            else if (typeof params.signer['address'] === 'string') {
                // viem WalletClient (direct address property)
                owner = params.signer['address'];
            }
            else if (typeof params.signer['account']?.address === 'string') {
                // viem WalletClient with account.address
                owner = params.signer['account'].address;
            }
            else {
                throw new Error('Invalid signer typer');
            }
            const poolAdrs = await config.pool.getAddress();
            const total = params.recipients.reduce((acc, cur) => acc + cur.amount, options?.fee ?? 0n);
            const tokenContract = new Contract(token, ERC20_ABI, { provider: config.provider });
            const allowance = await tokenContract.allowance(owner, poolAdrs);
            const deadline = await config.provider.getBlock('latest').then((b) => {
                if (!b)
                    throw Error('Provider failure');
                return BigInt(b.timestamp) + BigInt(options?.permitSeconds ?? 419);
            });
            let _permit;
            if (allowance < total) {
                const sig = await permit({
                    signer: params.signer,
                    spender: poolAdrs,
                    token,
                    amount: total,
                    deadline
                }).then(({ signature }) => Signature.from(signature));
                _permit = [BigInt(deadline), sig.v, sig.r, sig.s];
            }
            else {
                _permit = [BigInt(deadline), 0, zeroHash, zeroHash];
            }
            const inputs = [];
            let outputs = [];
            const depositId = options.depositId;
            // Try top-up if a compatible UTXO with empty component slots exists.
            const shouldAttemptTopup = options?.topup !== false &&
                params.recipients.length === 1 &&
                params.recipients[0].amount > 0n &&
                options?.userKeyPair;
            if (shouldAttemptTopup) {
                // Only allow top-up when recipient matches the user's shielded address.
                const recipientAddress = params.recipients[0].to.toLowerCase();
                const userAddress = options.userKeyPair instanceof SnapKeyPair
                    ? (await options.userKeyPair.address()).toLowerCase()
                    : options.userKeyPair.address().toLowerCase();
                if (recipientAddress === userAddress) {
                    // Find same token UTXOs owned by the user and then pick the one with most empty slots.
                    // Pull candidate UTXOs owned by the user for this token.
                    const utxosByToken = await futxos.findUtxos({
                        pool: config.pool,
                        keypair: options.userKeyPair,
                        tokens: [token]
                    });
                    const candidates = utxosByToken[token] ?? [];
                    let best = null;
                    let bestEmpty = -1;
                    for (const utxo of candidates) {
                        let emptySlots = 0;
                        let hasDepositId = false;
                        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                            const amount = utxo.subDepositAmounts[i];
                            if (amount === 0n) {
                                emptySlots++;
                                continue;
                            }
                            if (utxo.subDepositIds[i] === depositId) {
                                hasDepositId = true;
                            }
                        }
                        // Skip full UTXOs or ones that already contain this deposit_id.
                        if (emptySlots === 0 || hasDepositId)
                            continue;
                        // Prefer the UTXO with the most empty component slots.
                        if (emptySlots > bestEmpty) {
                            best = utxo;
                            bestEmpty = emptySlots;
                        }
                    }
                    if (best) {
                        inputs.push(best);
                        // Append the new deposit component to the selected UTXO.
                        const components = allocateDepositComponents(params.recipients[0].amount, depositId, best);
                        outputs = [
                            new Utxo({
                                token,
                                amount: best.amount + params.recipients[0].amount,
                                chainId,
                                keypair: best.keypair,
                                safe: best.safe,
                                subDepositIds: components.subDepositIds,
                                subDepositAmounts: components.subDepositAmounts,
                                type: UtxoType.Fund
                            })
                        ];
                    }
                }
            }
            // Fallback: mint new output(s) when top-up is not possible.
            if (outputs.length === 0) {
                outputs = params.recipients.map(({ amount, to }) => {
                    const components = allocateDepositComponents(amount, depositId);
                    return new Utxo({
                        token,
                        amount,
                        chainId,
                        keypair: KeyPair.fromAddress(to),
                        subDepositIds: components.subDepositIds,
                        subDepositAmounts: components.subDepositAmounts,
                        type: UtxoType.Fund
                    });
                });
            }
            const artifacts = await coreModule.prepareTransact({
                pool: config.pool,
                inputs,
                outputs,
                token,
                txKind: 'deposit',
                funder: owner,
                relayer: options?.relayer,
                fee: options?.fee,
                signer: params.signer,
                merkleTreeHeight: config.merkleTreeHeight,
                fromBlock: config.startBlock,
                toBlock: await config.provider.getBlockNumber().then(BigInt),
                safeModule
            });
            const [_args, _extData] = mapTransactArgs([artifacts.args, artifacts.extData]);
            let complianceRequest = artifacts.complianceRequest;
            if (!complianceRequest)
                throw new Error('deposit requires compliance request from prepareTransact');
            let attestationTuple;
            if (complianceRequest._bypass) {
                // Demo/testnet bypass: no compliance manager, use zero-value attestation.
                attestationTuple = [
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    0n,
                    '0x0000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                ];
            } else {
                complianceRequest.data = encodeInternalTransactData(_args, _extData, _permit);
                const complianceResult = await fetchComplianceCheck(config.complianceManager, complianceRequest);
                const attestation = complianceResult.attestationResponse.attestation;
                attestationTuple = [
                    attestation.uuid,
                    BigInt(attestation.expiration),
                    attestation.attester,
                    attestation.signature
                ];
            }
            const data = Interface.from(POOL_ABI).encodeFunctionData(TRANSACT_ABI, [
                _args,
                _extData,
                _permit,
                attestationTuple
            ]);
            return {
                chainId: Number(config.chainId),
                to: await config.pool.getAddress(),
                data
            };
        },
        /**
         * Assembles a single shielded transfer payload.
         * For chunked execution, use previewTransferPlan + executeTransferPlan.
         *
         * @param params.spender The sender's shielded key pair
         * @param params.token Token address
         * @param params.recipients[].amount Amount to transfer
         * @param params.recipients[].to Deposit recipient's shielded address
         * @param options.relayer Relayer shielded address
         * @param options.fee Relayer fee
         * @returns Transaction payload
         */
        async transfer(params, options) {
            if (!params.recipients.length) {
                throw new Error('requires at least one recipient');
            }
            const token = params.token.toLowerCase();
            const utxosByToken = await futxos.findUtxos({
                pool: config.pool,
                keypair: params.spender,
                tokens: [token]
            });
            const blacklistResult = await fetchComplianceBlackList(config.complianceManager);
            const blacklist = new Set(blacklistResult.blacklist.map(id => BigInt(id)));
            const transferAmount = params.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
            const feeAmount = options?.fee ?? 0n;
            const requiredTotal = transferAmount + feeAmount;
            // Check if compliant balance cannot cover the transfer amount.
            let availableCompliantTotal = 0n;
            for (const utxo of utxosByToken[token] ?? []) {
                for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                    const componentAmount = utxo.subDepositAmounts[i];
                    if (componentAmount === 0n)
                        continue;
                    if (blacklist.has(utxo.subDepositIds[i]))
                        continue;
                    availableCompliantTotal += componentAmount;
                }
            }
            if (availableCompliantTotal < requiredTotal) {
                throw new Error(`Insufficient compliant UTXO balance for transfer: available=${availableCompliantTotal}, required=${requiredTotal}`);
            }
            const selectedInputs = selectTransferInputCandidates(utxosByToken[token] ?? [], requiredTotal);
            const { inputs, outputs } = buildTransferInputsOutputs(params, selectedInputs, chainId, options, blacklist);
            return proveAndEncodeTransfer(inputs, outputs, token);
        },
        /**
         * Builds a chunk execution plan for transfer.
         * The plan fixes recipient amount splits per chunk, but does not include proofs.
         *
         * @param params Transfer parameters
         * @param options Transfer options
         * @returns Chunk plan
         */
        async previewTransferPlan(params, options) {
            if (!params.recipients.length) {
                throw new Error('requires at least one recipient');
            }
            const token = params.token.toLowerCase();
            // Snapshot recipients and initialize remaining amounts for planning.
            const baseRecipients = params.recipients.map(recipient => ({ ...recipient }));
            const remainingAmounts = baseRecipients.map(recipient => recipient.amount);
            const transferAmount = remainingAmounts.reduce((sum, amount) => sum + amount, 0n);
            const feeAmount = options?.fee ?? 0n;
            const requiredTotal = transferAmount + feeAmount;
            // Fail if total balance cannot cover the transfer.
            const initialUtxos = await assertTransferBalance(futxos.findUtxos, config.pool, params, token, requiredTotal);
            const blacklistResult = await fetchComplianceBlackList(config.complianceManager);
            const blacklist = new Set(blacklistResult.blacklist.map(id => BigInt(id)));
            // Check if compliant balance cannot cover the transfer amount.
            let availableCompliantTotal = 0n;
            for (const utxo of initialUtxos) {
                for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                    const componentAmount = utxo.subDepositAmounts[i];
                    if (componentAmount === 0n)
                        continue;
                    if (blacklist.has(utxo.subDepositIds[i]))
                        continue;
                    availableCompliantTotal += componentAmount;
                }
            }
            if (availableCompliantTotal < requiredTotal) {
                throw new Error(`Insufficient compliant UTXO balance for transfer: available=${availableCompliantTotal}, required=${requiredTotal}`);
            }
            const steps = [];
            const transferOptions = options;
            let localUtxos = [...initialUtxos];
            while (remainingAmounts.some(amount => amount > 0n)) {
                // Prevent unbounded chunk loops.
                if (steps.length >= MAX_TRANSFER_CHUNK_STEPS) {
                    throw new Error('transfer exceeded maximum chunk step count');
                }
                // Limit candidate set size for step resolution efficiency.
                const inputCandidates = sortDescByAmount(localUtxos).slice(0, 16);
                if (!inputCandidates.length) {
                    // No spendable inputs remain while there is still amount to send.
                    const remainingTotal = remainingAmounts.reduce((sum, amount) => sum + amount, 0n);
                    throw new Error(`No UTXOs found while transfer still has remaining=${remainingTotal}`);
                }
                // Decide how much to send in this step and which inputs/outputs realize it.
                const { stepAmounts, inputs, outputs } = await resolveTransferStep(params, baseRecipients, remainingAmounts, inputCandidates, chainId, transferOptions, blacklist);
                // Add this step to the plan. stepAmounts[i] is the amount sent to recipients[i] this step.
                const total = stepAmounts.reduce((sum, amount) => sum + amount, 0n);
                steps.push({
                    amounts: [...stepAmounts],
                    total,
                    inputs,
                    outputs
                });
                // Update remaining amounts after applying this step.
                subtractStepAmounts(remainingAmounts, stepAmounts);
                // Simulate UTXO consumption: remove inputs, add change outputs for the sender.
                localUtxos = localUtxos.filter(utxo => !inputs.includes(utxo));
                for (const output of outputs) {
                    if (output.type === UtxoType.Bogus && output.keypair === params.spender) {
                        localUtxos.push(output);
                    }
                }
            }
            return {
                token: params.token,
                recipients: baseRecipients,
                steps,
                total: transferAmount
            };
        },
        /**
         * Executes a precomputed transfer plan.
         * Each step rebuilds proof and payload against latest chain state.
         *
         * @param params Transfer parameters
         * @param plan Precomputed transfer plan
         * @param options Transfer options
         * @returns Relayed transaction hashes
         */
        async executeTransferPlan(params, plan) {
            // Relayer is required for submission.
            const relayUrl = config.relayer;
            if (!relayUrl) {
                throw new Error('requires relayer');
            }
            const token = params.token.toLowerCase();
            const baseRecipients = params.recipients.map(recipient => ({ ...recipient }));
            if (!baseRecipients.length) {
                throw new Error('requires at least one recipient');
            }
            // Ensure the plan's total matches requested total.
            const requiredTotal = baseRecipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
            const planTotal = plan.steps.reduce((sum, step) => sum + step.total, 0n);
            if (planTotal !== requiredTotal) {
                throw new Error(`invalid transfer plan total: plan=${planTotal}, required=${requiredTotal}`);
            }
            // Track remaining recipient amounts during execution.
            const remainingAmounts = baseRecipients.map(recipient => recipient.amount);
            await assertTransferBalance(futxos.findUtxos, config.pool, params, token, requiredTotal);
            const txHashes = [];
            let stepIndex = 0;
            while (remainingAmounts.some(amount => amount > 0n) && stepIndex < plan.steps.length) {
                if (txHashes.length >= MAX_TRANSFER_CHUNK_STEPS) {
                    throw new Error('transfer exceeded maximum chunk step count');
                }
                const plannedStep = plan.steps[stepIndex];
                let stepAmounts = [...plannedStep.amounts];
                let payload = null;
                // Validate step shape and remaining amounts.
                if (stepAmounts.length !== baseRecipients.length) {
                    throw new Error('invalid transfer plan step length');
                }
                for (let i = 0; i < stepAmounts.length; i++) {
                    if (stepAmounts[i] > remainingAmounts[i]) {
                        throw new Error('invalid transfer plan step amount');
                    }
                }
                // Plan must include concrete inputs&outputs.
                if (!plannedStep.inputs || !plannedStep.outputs) {
                    throw new Error('transfer plan missing inputs/outputs');
                }
                // Prove and encode payload from the planned inputs&outputs.
                payload = await proveAndEncodeTransfer(plannedStep.inputs, plannedStep.outputs, token);
                if (payload == null) {
                    throw new Error('transfer step payload or amounts missing');
                }
                // Relay the transaction and ensure it succeeded.
                const txHash = await relay(relayUrl, payload);
                const receipt = await config.provider.waitForTransaction(txHash);
                if (receipt?.status === 0) {
                    throw new Error('executeTransferPlan chunk relay reverted');
                }
                txHashes.push(txHash);
                // Apply consumed recipient amounts; this is the progress guard for the chunk loop.
                subtractStepAmounts(remainingAmounts, stepAmounts);
                stepIndex++;
            }
            // Plan must fully consume all recipient amounts.
            if (remainingAmounts.some(amount => amount > 0n)) {
                throw new Error('transfer plan ended before all recipient amounts were consumed');
            }
            return txHashes;
        },
        /**
         * Builds a chunk execution plan for withdraw.
         * The plan fixes inputs/outputs per step, but does not include proofs.
         *
         * @param params Withdraw parameters
         * @param options Withdraw options
         * @returns Chunk plan
         */
        async previewWithdrawPlan(params, _options) {
            const token = params.token.toLowerCase();
            const requiredTotal = params.amount;
            // Fetch initial UTXOs and check if total balance is insufficient.
            const initialUtxosByToken = await futxos.findUtxos({
                pool: config.pool,
                keypair: params.spender,
                tokens: [token]
            });
            const initialTokenUtxos = initialUtxosByToken[token] ?? [];
            // Snapshot blacklist for deterministic planning.
            const blacklistResult = await fetchComplianceBlackList(config.complianceManager);
            const blacklist = new Set(blacklistResult.blacklist.map(id => BigInt(id)));
            // Compute total spendable amount ignoring blacklisted deposit components if the isPublic flag is false and vice versa.
            let availableTotal = 0n;
            for (const utxo of initialTokenUtxos) {
                for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                    const componentAmount = utxo.subDepositAmounts[i];
                    if (componentAmount === 0n)
                        continue;
                    if (params.isPublic
                        ? !blacklist.has(utxo.subDepositIds[i])
                        : blacklist.has(utxo.subDepositIds[i]))
                        continue;
                    availableTotal += componentAmount;
                }
            }
            // Check compliant balance is insufficient.
            if (availableTotal < requiredTotal) {
                throw new Error(`Insufficient UTXO balance for withdraw: available=${availableTotal}, required=${requiredTotal}`);
            }
            const steps = [];
            let remainingAmount = requiredTotal;
            // Local UTXO state for simulation across steps.
            let localUtxos = [...initialTokenUtxos];
            while (remainingAmount > 0n) {
                if (steps.length >= MAX_WITHDRAW_CHUNK_STEPS) {
                    throw new Error('withdraw exceeded maximum chunk step count');
                }
                // Limit candidate set size for step resolution efficiency.
                const inputCandidates = sortDescByAmount(localUtxos).slice(0, 16);
                if (!inputCandidates.length) {
                    throw new Error(`No UTXOs found while withdraw still has remaining=${remainingAmount}`);
                }
                // Decide step amount and its concrete inputs/outputs.
                const { stepAmount, inputs, outputs } = resolveWithdrawStep(params, remainingAmount, inputCandidates, blacklist, chainId);
                steps.push({
                    amount: stepAmount,
                    inputs,
                    outputs
                });
                // Update remaining amount after applying this step.
                remainingAmount -= stepAmount;
                // Simulate UTXO consumption: remove inputs, add change outputs for the sender.
                localUtxos = localUtxos.filter(utxo => !inputs.includes(utxo));
                for (const output of outputs) {
                    if (output.type === UtxoType.Bogus && output.keypair === params.spender) {
                        localUtxos.push(output);
                    }
                }
            }
            return {
                token: params.token,
                to: params.to,
                steps,
                total: requiredTotal
            };
        },
        /**
         * Executes a precomputed withdraw plan.
         * Each step rebuilds proof and payload against latest chain state.
         *
         * @param params Withdraw parameters
         * @param plan Precomputed withdraw plan
         * @param options Withdraw options
         * @returns Relayed transaction hashes
         */
        async executeWithdrawPlan(params, plan, options) {
            // Relayer is required for submission.
            const relayUrl = config.relayer;
            if (!relayUrl) {
                throw new Error('requires relayer');
            }
            // Ensure the plan's total matches requested total.
            const requiredTotal = params.amount;
            const planTotal = plan.steps.reduce((sum, step) => sum + step.amount, 0n);
            if (planTotal !== requiredTotal) {
                throw new Error(`invalid withdraw plan total: plan=${planTotal}, required=${requiredTotal}`);
            }
            if (plan.token.toLowerCase() !== params.token.toLowerCase()) {
                throw new Error('invalid withdraw plan token');
            }
            if (plan.to.toLowerCase() !== params.to.toLowerCase()) {
                throw new Error('invalid withdraw plan recipient');
            }
            let remainingAmount = requiredTotal;
            const txHashes = [];
            for (const plannedStep of plan.steps) {
                if (txHashes.length >= MAX_WITHDRAW_CHUNK_STEPS) {
                    throw new Error('withdraw exceeded maximum chunk step count');
                }
                // Validate step shape before proof generation.
                if (plannedStep.amount > remainingAmount) {
                    throw new Error('invalid withdraw plan step amount');
                }
                // Plan must include concrete inputs&outputs.
                if (!plannedStep.inputs || !plannedStep.outputs) {
                    throw new Error('withdraw plan missing inputs/outputs');
                }
                // Sanity-check step totals.
                const inputTotal = plannedStep.inputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
                const outputTotal = plannedStep.outputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
                const impliedAmount = inputTotal - outputTotal;
                if (impliedAmount !== plannedStep.amount) {
                    throw new Error(`invalid withdraw plan step total: implied=${impliedAmount}, planned=${plannedStep.amount}`);
                }
                // Prove and encode payload from the planned inputs&outputs.
                const payload = await proveAndEncodeWithdraw(plannedStep.inputs, plannedStep.outputs, false, params, options);
                // Relay the transaction and ensure it succeeded.
                const txHash = await relay(relayUrl, payload);
                const receipt = await config.provider.waitForTransaction(txHash);
                if (receipt?.status === 0) {
                    throw new Error('executeWithdrawPlan chunk relay reverted');
                }
                txHashes.push(txHash);
                // Apply consumed amount for progress tracking.
                remainingAmount -= plannedStep.amount;
            }
            // Plan must fully consume the requested amount.
            if (remainingAmount > 0n) {
                throw new Error('withdraw plan ended before all amount was consumed');
            }
            return txHashes;
        },
        /**
         * Executes a precomputed public withdraw plan.
         * Each step rebuilds proof and payload against latest chain state.
         *
         * @param params Public withdraw parameters
         * @param plan Precomputed public withdraw plan
         * @param options Public Withdraw options
         * @returns Relayed transaction hashes
         */
        async executePublicWithdrawPlan(params, plan, options) {
            // Relayer is required for submission.
            const relayUrl = config.relayer;
            if (!relayUrl) {
                throw new Error('requires relayer');
            }
            // Ensure the plan's total matches requested total.
            const requiredTotal = params.amount;
            const planTotal = plan.steps.reduce((sum, step) => sum + step.amount, 0n);
            if (planTotal !== requiredTotal) {
                throw new Error(`invalid publicWithdraw plan total: plan=${planTotal}, required=${requiredTotal}`);
            }
            if (plan.token.toLowerCase() !== params.token.toLowerCase()) {
                throw new Error('invalid withdraw plan token');
            }
            if (plan.to.toLowerCase() !== params.to.toLowerCase()) {
                throw new Error('invalid withdraw plan recipient');
            }
            let remainingAmount = requiredTotal;
            const txHashes = [];
            for (const plannedStep of plan.steps) {
                if (txHashes.length >= MAX_WITHDRAW_CHUNK_STEPS) {
                    throw new Error('withdraw exceeded maximum chunk step count');
                }
                // Validate step shape before proof generation.
                if (plannedStep.amount > remainingAmount) {
                    throw new Error('invalid withdraw plan step amount');
                }
                // Plan must include concrete inputs&outputs.
                if (!plannedStep.inputs || !plannedStep.outputs) {
                    throw new Error('withdraw plan missing inputs/outputs');
                }
                // Sanity-check step totals.
                const inputTotal = plannedStep.inputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
                const outputTotal = plannedStep.outputs.reduce((sum, utxo) => sum + utxo.amount, 0n);
                const impliedAmount = inputTotal - outputTotal;
                if (impliedAmount !== plannedStep.amount) {
                    throw new Error(`invalid withdraw plan step total: implied=${impliedAmount}, planned=${plannedStep.amount}`);
                }
                // Prove and encode payload from the planned inputs&outputs.
                const payload = await proveAndEncodeWithdraw(plannedStep.inputs, plannedStep.outputs, true, params, options);
                // Relay the transaction and ensure it succeeded.
                const txHash = await relay(relayUrl, payload);
                const receipt = await config.provider.waitForTransaction(txHash);
                if (receipt?.status === 0) {
                    throw new Error('executeWithdrawPlan chunk relay reverted');
                }
                txHashes.push(txHash);
                // Apply consumed amount for progress tracking.
                remainingAmount -= plannedStep.amount;
            }
            // Plan must fully consume the requested amount.
            if (remainingAmount > 0n) {
                throw new Error('withdraw plan ended before all amount was consumed');
            }
            return txHashes;
        },
        /**
         * Assembles a withdrawal payload.
         *
         * @param params.spender The sender's shielded key pair
         * @param params.token Token address
         * @param params.amount Amount to withdraw
         * @param params.to Recipient's native address
         * @param options.relayer Relayer's native address
         * @param options.fee Relayer fee
         * @param options.unwrap Unwrap WETH?
         * @returns Transaction payload
         */
        async withdraw(params, options) {
            const token = params.token.toLowerCase();
            const inputs = await futxos.findUtxosUpTo({
                pool: config.pool,
                token,
                amount: params.amount,
                keypair: params.spender
            });
            const { inputs: inputUtxos, outputs } = buildWithdrawInputsOutputs(token, chainId, params.spender, inputs, params.amount);
            return proveAndEncodeWithdraw(inputUtxos, outputs, false, params, options);
        },
        /**
         * Assembles a public withdrawal payload.
         *
         * @param params.senderKeyPair The sender's shielded key pair
         * @param params.token Token address
         * @param params.amount Amount to withdraw
         * @param params.recipient Recipient's native address
         * @param options.relayer Relayer's native address
         * @param options.fee Relayer fee
         * @param options.unwrap Unwrap WETH?
         * @returns Transaction payload
         */
        async publicWithdraw(params, options) {
            const token = params.token.toLowerCase();
            const inputs = await futxos.findUtxosUpTo({
                pool: config.pool,
                token,
                amount: params.amount,
                keypair: params.spender,
                targetCompliant: false
            });
            const { inputs: inputUtxos, outputs } = buildWithdrawInputsOutputs(token, chainId, params.spender, inputs, params.amount, true);
            return proveAndEncodeWithdraw(inputUtxos, outputs, true, params, options);
        }
    };
}
//# sourceMappingURL=ops.js.map