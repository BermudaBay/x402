import Utxo from './utxo.js';
import KeyPair from './keypair.js';
import { MAX_STX_INPUT_UTXOS, MAX_STX_OUTPUT_UTXOS, STX_DEPOSIT_COMPONENTS, STX_DEPOSIT_ID_SLOTS, sortDescByAmount } from './utils.js';
import { UtxoType } from './types.js';
// Build sub-deposit components for a deposit output.
// If a base UTXO is provided, we append the new deposit_id into its first empty slot.
export const allocateDepositComponents = (amount, depositId, base) => {
    const subDepositIds = base ? [...base.subDepositIds] : new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
    const subDepositAmounts = base
        ? [...base.subDepositAmounts]
        : new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
    if (amount > 0n) {
        // For top-up, pick the first empty component slot.
        const slot = base ? subDepositAmounts.findIndex(value => value === 0n) : 0;
        if (slot === -1) {
            throw new Error('No available deposit component slot for topup');
        }
        subDepositIds[slot] = depositId;
        subDepositAmounts[slot] = amount;
    }
    return { subDepositIds, subDepositAmounts };
};
// Allocate remaining compliant components to withdraw change outputs.
// TODO: Optimize to minimize non-zero components in change by fully consuming deposit_id components.
export const allocateWithdrawComponents = (inputs, withdrawAmount, maxChangeOutputs, isPublic = false) => {
    const componentSources = [];
    const componentIndexById = new Map();
    const uncompliantIds = new Set(inputs.uncompliantDepositIds ?? []);
    // Aggregate input components by deposit_id to get available balances.
    for (const utxo of inputs.utxos) {
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            const amount = utxo.subDepositAmounts[i];
            if (amount === 0n)
                continue;
            const id = utxo.subDepositIds[i];
            // Filtering Logic:
            // private withdraw (!isPublic): Skip if ID is uncompliant
            // Public withdraw (isPublic): Skip if ID is compliant
            const isUncompliant = uncompliantIds.has(id);
            if (isPublic ? !isUncompliant : isUncompliant)
                continue;
            if (id === 0n) {
                throw new Error('Deposit id required for non-zero deposit component');
            }
            const existing = componentIndexById.get(id);
            if (existing === undefined) {
                componentIndexById.set(id, componentSources.length);
                componentSources.push({ id, amount });
            }
            else {
                componentSources[existing].amount += amount;
            }
        }
    }
    // Subtract the withdrawn amount from the pooled compliant balances in order.
    let remaining = withdrawAmount;
    for (const source of componentSources) {
        if (remaining === 0n)
            break;
        if (source.amount <= remaining) {
            remaining -= source.amount;
            source.amount = 0n;
        }
        else {
            source.amount -= remaining;
            remaining = 0n;
        }
    }
    if (remaining > 0n) {
        throw new Error('Insufficient deposit components to cover withdrawal amount');
    }
    // Drop fully-consumed sources so we don't over-count required outputs.
    const nonZeroSources = componentSources.filter(source => source.amount > 0n);
    if (!nonZeroSources.length)
        return [];
    // Compute ceil(remainingComponents / STX_DEPOSIT_COMPONENTS) to get the required number of change UTXOs.
    const requiredOutputs = Math.ceil(nonZeroSources.length / STX_DEPOSIT_COMPONENTS);
    if (requiredOutputs > maxChangeOutputs) {
        throw new Error('Withdraw change requires too many deposit components');
    }
    const allocations = [];
    // Split remaining components into groups of STX_DEPOSIT_COMPONENTS;
    // each group becomes one change UTXO's component list.
    for (let offset = 0; offset < nonZeroSources.length; offset += STX_DEPOSIT_COMPONENTS) {
        const subDepositIds = new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
        const subDepositAmounts = new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
        const slice = nonZeroSources.slice(offset, offset + STX_DEPOSIT_COMPONENTS);
        for (let i = 0; i < slice.length; i++) {
            subDepositIds[i] = slice[i].id;
            subDepositAmounts[i] = slice[i].amount;
        }
        allocations.push({ subDepositIds, subDepositAmounts });
    }
    return allocations;
};
// Select input UTXOs for a single transfer under amount/input/deposit-id limits.
export const selectTransferInputCandidates = (inputCandidates, requestedAmount) => {
    const candidates = sortDescByAmount([...inputCandidates]).slice(0, 16);
    if (!candidates.length) {
        throw new Error(`No UTXOs found to cover transfer amount ${requestedAmount}`);
    }
    // Best feasible subset found so far.
    let best = null;
    // Unique deposit-id count of best
    let bestUniqueIds = Number.MAX_SAFE_INTEGER;
    // Current subset under DFS.
    const picked = [];
    // Check if current picked can be used as transfer inputs.
    // Must satisfy: enough amount, input UTXO count limit, deposit-id slot limit.
    // If multiple subsets pass, keep the one with fewer unique ids, and if tied, fewer input UTXOs.
    const evaluate = (sum) => {
        if (sum < requestedAmount || picked.length > MAX_STX_INPUT_UTXOS)
            return;
        const ids = new Set();
        for (const utxo of picked) {
            for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                if (utxo.subDepositAmounts[i] === 0n)
                    continue;
                ids.add(utxo.subDepositIds[i]);
            }
        }
        const uniqueIds = ids.size;
        if (uniqueIds > STX_DEPOSIT_ID_SLOTS)
            return;
        if (best == null ||
            uniqueIds < bestUniqueIds ||
            (uniqueIds === bestUniqueIds && picked.length < best.length)) {
            best = [...picked];
            bestUniqueIds = uniqueIds;
        }
    };
    // Enumerate candidate combinations with DFS.
    const search = (start, sum) => {
        if (picked.length > MAX_STX_INPUT_UTXOS)
            return;
        // Evaluate the subset represented by current picked.
        evaluate(sum);
        // If we already use the maximum input count, do not go deeper.
        if (picked.length === MAX_STX_INPUT_UTXOS)
            return;
        for (let i = start; i < candidates.length; i++) {
            // Include candidates[i], explore all deeper subsets, then restore.
            picked.push(candidates[i]);
            search(i + 1, sum + candidates[i].amount);
            picked.pop();
        }
    };
    search(0, 0n);
    if (best == null) {
        throw new Error(`Cannot satisfy amount ${requestedAmount} under deposit id slot limit`);
    }
    return best;
};
// Allocate sub-deposit components across transfer outputs.
// TODO: Optimize allocation to minimize total non-zero components across outputs UTXO.
export const allocateTransferOutputComponents = (inputs, outputSpecs, maxOutputs, blacklist) => {
    // Separate component sources into compliant/uncompliant buckets.
    const compliantSources = [];
    const uncompliantSources = [];
    const compliantIndexById = new Map();
    const uncompliantIndexById = new Map();
    // Aggregate input components by deposit_id to get available balances.
    for (const utxo of inputs) {
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            const amount = utxo.subDepositAmounts[i];
            if (amount === 0n)
                continue;
            const id = utxo.subDepositIds[i];
            if (id === 0n) {
                throw new Error('Deposit id required for non-zero deposit component');
            }
            const isUncompliant = blacklist?.has(id) ?? false;
            const indexById = isUncompliant ? uncompliantIndexById : compliantIndexById;
            const sources = isUncompliant ? uncompliantSources : compliantSources;
            const existing = indexById.get(id);
            if (existing === undefined) {
                indexById.set(id, sources.length);
                sources.push({ id, amount });
            }
            else {
                sources[existing].amount += amount;
            }
        }
    }
    // Enforce: compliant-only outputs(recipient and fee) must be fully coverable by compliant sources.
    const totalCompliant = compliantSources.reduce((sum, source) => sum + source.amount, 0n);
    const requiredCompliant = outputSpecs
        .filter(spec => spec.requiresCompliant)
        .reduce((sum, spec) => sum + spec.amount, 0n);
    if (totalCompliant < requiredCompliant) {
        throw new Error('Insufficient compliant deposit components to cover transfer outputs');
    }
    const compliantState = { sources: compliantSources, index: 0 };
    const mixedState = { sources: [...uncompliantSources, ...compliantSources], index: 0 };
    // Pick the next available component source from ordered state buckets.
    const nextSource = (states) => {
        for (const state of states) {
            while (state.index < state.sources.length && state.sources[state.index].amount === 0n) {
                state.index++;
            }
            if (state.index < state.sources.length) {
                return state.sources[state.index];
            }
        }
        return null;
    };
    // Expanded output specs after splitting overflow components into extra UTXOs.
    const expandedOutputSpecs = [];
    // Component arrays aligned with expandedOutputSpecs.
    const allocations = [];
    // Keep per-spec allocations to rebuild outputs in original order later.
    const allocationsBySpec = outputSpecs.map(() => []);
    let remainingOutputSlots = maxOutputs;
    // Allocate components for one output spec, splitting if components overflow.
    const allocateSpec = (specIndex, spec, states) => {
        let remaining = spec.amount;
        // If one output needs > STX_DEPOSIT_COMPONENTS components, split it into
        // multiple outputs for the same recipient/change/fee up to maxOutputs.
        while (remaining > 0n) {
            // Check do not exceed total output slot limit.
            if (remainingOutputSlots <= 0) {
                throw new Error('Transfer output requires too many deposit components');
            }
            // Start a new output allocation up to STX_DEPOSIT_COMPONENTS components.
            const subDepositIds = new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
            const subDepositAmounts = new Array(STX_DEPOSIT_COMPONENTS).fill(0n);
            let componentIndex = 0;
            let allocatedAmount = 0n;
            // Fill this output by consuming from componentSources in order.
            while (remaining > 0n) {
                // No more component sources to draw from.
                const source = nextSource(states);
                if (!source) {
                    throw new Error('Insufficient deposit components to cover transfer outputs');
                }
                // Stop and open a new output once the component slot limit is reached.
                if (componentIndex >= STX_DEPOSIT_COMPONENTS) {
                    break;
                }
                // Take as much as possible from this source without exceeding the remaining amount.
                const take = remaining < source.amount ? remaining : source.amount;
                subDepositIds[componentIndex] = source.id;
                subDepositAmounts[componentIndex] = take;
                componentIndex++;
                remaining -= take;
                allocatedAmount += take;
                // Consume from the current source.
                source.amount -= take;
            }
            // If nothing was allocated, this output cannot be formed.
            if (allocatedAmount === 0n) {
                throw new Error('Transfer output requires too many deposit components');
            }
            // Emit one output allocation and continue if there's still remaining amount.
            allocationsBySpec[specIndex].push({
                subDepositIds,
                subDepositAmounts,
                amount: allocatedAmount
            });
            remainingOutputSlots--;
        }
    };
    // Allocate compliant-only outputs first (recipients and fee).
    for (let i = 0; i < outputSpecs.length; i++) {
        const spec = outputSpecs[i];
        if (!spec.requiresCompliant)
            continue;
        allocateSpec(i, spec, [compliantState]);
    }
    // Allocate remaining outputs from any remaining sources (compliant or uncompliant).
    for (let i = 0; i < outputSpecs.length; i++) {
        const spec = outputSpecs[i];
        if (spec.requiresCompliant)
            continue;
        allocateSpec(i, spec, [mixedState]);
    }
    // Rebuild expanded outputs in original order.
    for (let i = 0; i < outputSpecs.length; i++) {
        const spec = outputSpecs[i];
        for (const allocation of allocationsBySpec[i]) {
            expandedOutputSpecs.push({
                amount: allocation.amount,
                keypair: spec.keypair,
                type: spec.type
            });
            allocations.push({
                subDepositIds: allocation.subDepositIds,
                subDepositAmounts: allocation.subDepositAmounts
            });
        }
    }
    for (const source of [...compliantSources, ...uncompliantSources]) {
        if (source.amount !== 0n) {
            throw new Error('Unallocated deposit components remain after transfer allocation');
        }
    }
    return { outputSpecs: expandedOutputSpecs, outputComponents: allocations };
};
// Build inputs/outputs for a single transfer without proof generation.
// - Construct outputs (fee, recipients, change)
// - Allocate sub-deposit components
export const buildTransferInputsOutputs = (params, inputs, chainId, options, blacklist) => {
    const token = Array.isArray(params) ? params[0]?.token.toLowerCase() : params.token.toLowerCase();
    // Check that we can fit all recipients.
    // If fee and multi recipients is set make sure we can include one output utxo for the relayer.
    if (params.recipients.length >= (options?.fee ? MAX_STX_OUTPUT_UTXOS - 1 : MAX_STX_OUTPUT_UTXOS)) {
        throw new Error('Too many recipients');
    }
    if ((options?.fee && !options?.relayer) || (!options?.fee && options?.relayer)) {
        throw Error('Options fee and relayer must be mutually inclusive.');
    }
    const amount = params.recipients.reduce((acc, curr) => acc + curr.amount, 0n);
    const feeAmount = options?.fee ?? 0n;
    const totalOutputAmount = amount + feeAmount;
    if (!inputs.length) {
        throw new Error(`No UTXOs found to cover transfer amount ${totalOutputAmount}`);
    }
    const outputSpecs = [];
    // If a fee is set include one output UTXO for the relayer.
    if (options?.fee && options?.relayer) {
        outputSpecs.push({
            amount: options.fee,
            keypair: KeyPair.fromAddress(options.relayer),
            type: UtxoType.Transfer,
            requiresCompliant: true
        });
    }
    // The recipients' UTXOs.
    for (let i = 0; i < params.recipients.length; i++) {
        outputSpecs.push({
            amount: params.recipients[i].amount,
            keypair: KeyPair.fromAddress(params.recipients[i].to),
            type: UtxoType.Transfer,
            requiresCompliant: true
        });
    }
    // The sender's change UTXO (if there's a remainder).
    const remainder = inputs.reduce((accum, utxo) => (accum += utxo.amount), 0n) - totalOutputAmount;
    if (remainder) {
        outputSpecs.push({
            amount: remainder,
            keypair: params.spender,
            type: UtxoType.Bogus,
            requiresCompliant: false
        });
    }
    // Expand outputs if component overflow requires extra UTXOs (same recipient/change/fee).
    const { outputSpecs: expandedOutputSpecs, outputComponents } = allocateTransferOutputComponents(inputs, outputSpecs, MAX_STX_OUTPUT_UTXOS, blacklist);
    const outputs = expandedOutputSpecs.map((spec, idx) => {
        const components = outputComponents[idx];
        return new Utxo({
            token,
            chainId,
            keypair: spec.keypair,
            amount: spec.amount,
            subDepositIds: components.subDepositIds,
            subDepositAmounts: components.subDepositAmounts,
            type: spec.type
        });
    });
    return { inputs, outputs, token };
};
const TRANSFER_STEP_DIVISORS = [2n, 3n, 4n, 6n, 8n, 12n, 16n, 24n, 32n];
// Errors that can be recovered by shrinking per-step transfer amounts.
const isRetryableTransferSplitError = (error) => {
    if (!(error instanceof Error))
        return false;
    return [
        'Cannot satisfy amount',
        'Too many deposit ids',
        'Incorrect inputs/outputs count',
        'Transfer output requires too many deposit components',
        'Insufficient deposit components to cover transfer outputs',
        'Insufficient compliant deposit components to cover transfer outputs',
        'No UTXOs found to cover transfer amount',
        'Unallocated deposit components remain after transfer allocation'
    ].some(message => error.message.includes(message));
};
// Subtract one chunk's per-recipient amounts from remaining plan state.
export const subtractStepAmounts = (remainingAmounts, stepAmounts) => {
    let consumed = false;
    for (let i = 0; i < remainingAmounts.length; i++) {
        const stepAmount = stepAmounts[i];
        if (stepAmount > remainingAmounts[i]) {
            throw new Error('transfer step over-consumed recipient amount');
        }
        remainingAmounts[i] = remainingAmounts[i] - stepAmount;
        if (stepAmount > 0n)
            consumed = true;
    }
    if (!consumed) {
        throw new Error('transfer step did not consume any recipient amount');
    }
};
// Preflight check that sender has enough total spendable balance.
export const assertTransferBalance = async (findUtxos, pool, params, token, requiredTotal) => {
    // Fast pre-check before any chunk planning/execution work.
    const initialUtxosByToken = await findUtxos({
        pool,
        keypair: params.spender,
        tokens: [token]
    });
    const initialTokenUtxos = initialUtxosByToken[token] ?? [];
    const availableTotal = initialTokenUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
    if (availableTotal < requiredTotal) {
        throw new Error(`Insufficient UTXO balance for transfer: available=${availableTotal}, required=${requiredTotal}`);
    }
    return initialTokenUtxos;
};
// Build one executable transfer step (inputs/outputs + per-recipient step amounts).
export const resolveTransferStep = async (params, baseRecipients, remainingAmounts, inputCandidates, chainId, options, blacklist) => {
    const feeAmount = options?.fee ?? 0n;
    // First attempt the full remaining amounts as a single step.
    // If circuit constraints fail, we fallback to subset/scaled candidates below.
    const currentRecipients = baseRecipients.map((recipient, idx) => ({
        ...recipient,
        amount: remainingAmounts[idx]
    }));
    let inputs = null;
    let outputs = null;
    let stepAmounts = null;
    // First try a single-step transfer with all remaining recipient amounts.
    try {
        const stepAmount = currentRecipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
        const selectedInputs = selectTransferInputCandidates(inputCandidates, stepAmount + feeAmount);
        const built = buildTransferInputsOutputs({ ...params, recipients: currentRecipients }, selectedInputs, chainId, options, blacklist);
        inputs = built.inputs;
        outputs = built.outputs;
        stepAmounts = [...remainingAmounts];
    }
    catch (error) {
        if (!isRetryableTransferSplitError(error))
            throw error;
    }
    if (inputs == null) {
        const candidateAmountsList = [];
        const seen = new Set();
        // Full remaining amounts were already attempted above.
        seen.add(remainingAmounts.map(amount => amount.toString()).join(','));
        const recipientCount = remainingAmounts.length;
        // Candidate dedupe is key because subset + divisor enumeration can overlap.
        const addCandidate = (candidate) => {
            if (!candidate.some(amount => amount > 0n))
                return;
            const key = candidate.map(amount => amount.toString()).join(',');
            if (seen.has(key))
                return;
            seen.add(key);
            candidateAmountsList.push(candidate);
        };
        // Full subset candidates: choose which recipients to advance in this step.
        for (let mask = 1; mask < 1 << recipientCount; mask++) {
            const candidate = remainingAmounts.map((amount, idx) => (mask & (1 << idx) ? amount : 0n));
            addCandidate(candidate);
        }
        // Scaled subset candidates: try smaller step amounts when full subset does not fit.
        for (const divisor of TRANSFER_STEP_DIVISORS) {
            for (let mask = 1; mask < 1 << recipientCount; mask++) {
                const candidate = remainingAmounts.map((amount, idx) => mask & (1 << idx) ? amount / divisor : 0n);
                if (!candidate.some(amount => amount > 0n)) {
                    const firstSelected = remainingAmounts.findIndex((amount, idx) => (mask & (1 << idx)) !== 0 && amount > 0n);
                    if (firstSelected >= 0) {
                        candidate[firstSelected] = 1n;
                    }
                }
                addCandidate(candidate);
            }
        }
        // Prefer candidates that consume larger total amount to reduce number of chunks.
        candidateAmountsList.sort((lhs, rhs) => {
            const lhsTotal = lhs.reduce((sum, amount) => sum + amount, 0n);
            const rhsTotal = rhs.reduce((sum, amount) => sum + amount, 0n);
            if (lhsTotal === rhsTotal)
                return 0;
            return lhsTotal > rhsTotal ? -1 : 1;
        });
        // Try candidates in order and stop at the first feasible payload.
        for (const candidateAmounts of candidateAmountsList) {
            try {
                const stepAmount = candidateAmounts.reduce((sum, amount) => sum + amount, 0n);
                const selectedInputs = selectTransferInputCandidates(inputCandidates, stepAmount + feeAmount);
                const built = buildTransferInputsOutputs({
                    ...params,
                    recipients: baseRecipients.map((recipient, idx) => ({
                        ...recipient,
                        amount: candidateAmounts[idx]
                    }))
                }, selectedInputs, chainId, options, blacklist);
                inputs = built.inputs;
                outputs = built.outputs;
                stepAmounts = candidateAmounts;
                break;
            }
            catch (error) {
                if (!isRetryableTransferSplitError(error))
                    throw error;
            }
        }
        if (stepAmounts == null || !stepAmounts.some(amount => amount > 0n)) {
            const remainingTotal = remainingAmounts.reduce((sum, amount) => sum + amount, 0n);
            throw new Error(`Unable to progress transfer under deposit id slot limit (remaining=${remainingTotal})`);
        }
    }
    if (stepAmounts == null || inputs == null || outputs == null) {
        throw new Error('transfer step payload or amounts missing');
    }
    return { stepAmounts, inputs, outputs };
};
const WITHDRAW_STEP_DIVISORS = [2n, 3n, 4n, 6n, 8n, 12n, 16n, 24n, 32n];
// Errors that can be recovered by shrinking per-step withdraw amounts.
const isRetryableWithdrawSplitError = (error) => {
    if (!(error instanceof Error))
        return false;
    return [
        'withdraw amount exceeds input total',
        'withdraw requires too many output UTXOs',
        'Withdraw change requires too many deposit components',
        'Insufficient deposit components to cover withdrawal amount',
        'cannot cover amount with compliant utxos',
        'cannot cover amount with selected utxos',
        'No UTXOs found to cover withdrawal amount'
    ].some(message => error.message.includes(message));
};
// Build input UTXO candidates for withdraw and public withdraw.
// resolveWithdrawStep uses these to decide which inputs to try when building outputs.
// Each candidate can cover the amount with compliant/uncompliant funds based on isPublic flag.
const selectWithdrawInputCandidates = (candidates, amount, blacklist, isPublic) => {
    const sortedCandidates = sortDescByAmount([...candidates]).slice(0, 16);
    if (sortedCandidates.length === 0) {
        throw new Error('cannot cover amount with compliant utxos.');
    }
    // Precompute compliant/uncompliant amounts for each candidate.
    const candidateMeta = sortedCandidates.map(utxo => {
        let compliantAmount = 0n;
        let uncompliantAmount = 0n;
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            const componentAmount = utxo.subDepositAmounts[i];
            if (componentAmount === 0n)
                continue;
            const id = utxo.subDepositIds[i];
            if (blacklist.has(id)) {
                uncompliantAmount += componentAmount;
            }
            else {
                compliantAmount += componentAmount;
            }
        }
        return {
            utxo,
            compliantAmount,
            uncompliantAmount,
            totalAmount: compliantAmount + uncompliantAmount
        };
    });
    // Prefer higher compliant amount.
    candidateMeta.sort((lhs, rhs) => {
        return lhs.compliantAmount === rhs.compliantAmount
            ? 0
            : lhs.compliantAmount > rhs.compliantAmount
                ? -1
                : 1;
    });
    // Prefer higher uncompliant amount.
    candidateMeta.sort((lhs, rhs) => {
        return lhs.uncompliantAmount === rhs.uncompliantAmount
            ? 0
            : lhs.uncompliantAmount > rhs.uncompliantAmount
                ? -1
                : 1;
    });
    // Greedy candidate. Take largest compliant/uncompliant UTXOs first until amount is covered.
    // Optional skipIndex lets us drop one of the top candidates to get alternatives.
    const buildGreedyCandidate = (isPublic, skipIndex) => {
        let sum = 0n;
        const pickedUtxos = [];
        for (let i = 0; i < candidateMeta.length; i++) {
            if (pickedUtxos.length >= MAX_STX_INPUT_UTXOS)
                break;
            if (skipIndex !== undefined && i === skipIndex)
                continue;
            const meta = candidateMeta[i];
            if (isPublic ? meta.uncompliantAmount === 0n : meta.compliantAmount === 0n)
                continue;
            pickedUtxos.push(meta.utxo);
            let targetAmount = isPublic ? meta.uncompliantAmount : meta.compliantAmount;
            sum += targetAmount;
            if (sum >= amount)
                break;
        }
        if (sum < amount)
            return null;
        return pickedUtxos;
    };
    // Collect unique candidate sets.
    const candidateSets = [];
    const seenKeys = new Set();
    const pushCandidate = (utxos) => {
        if (!utxos || utxos.length === 0)
            return;
        const key = utxos.map(u => u.getCommitment().toString()).join('|');
        if (seenKeys.has(key))
            return;
        seenKeys.add(key);
        candidateSets.push(utxos);
    };
    // Base greedy candidate.
    pushCandidate(buildGreedyCandidate(isPublic));
    // Try skipping each of the top N candidates to get alternative sets.
    const maxSkips = Math.min(10, candidateMeta.length);
    for (let i = 0; i < maxSkips; i++) {
        pushCandidate(buildGreedyCandidate(isPublic, i));
    }
    // Validate candidates and attach uncompliant metadata.
    const outputs = [];
    for (const pickedUtxos of candidateSets) {
        // Aggregate deposit_id totals for blacklist checks.
        const depositIds = new Set();
        const amountById = new Map();
        for (const utxo of pickedUtxos) {
            for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                const componentAmount = utxo.subDepositAmounts[i];
                if (componentAmount === 0n)
                    continue;
                const id = utxo.subDepositIds[i];
                depositIds.add(id);
                const existing = amountById.get(id);
                if (existing === undefined) {
                    amountById.set(id, componentAmount);
                }
                else {
                    amountById.set(id, existing + componentAmount);
                }
            }
        }
        // one step cannot consume more than the fixed deposit-id slot capacity in the circuit.
        if (depositIds.size > STX_DEPOSIT_ID_SLOTS) {
            continue;
        }
        const depositIdsArray = [...depositIds].map(id => id.toString()).sort();
        const uncompliantIds = depositIdsArray.filter(id => blacklist.has(BigInt(id)));
        const compliantIds = depositIdsArray.filter(id => !blacklist.has(BigInt(id)));
        // Sum of all compliant/uncompliant components within this candidate set.
        const uncompliantSum = uncompliantIds.reduce((sum, id) => sum + (amountById.get(BigInt(id)) ?? 0n), 0n);
        const compliantSum = compliantIds.reduce((sum, id) => sum + (amountById.get(BigInt(id)) ?? 0n), 0n);
        outputs.push({
            utxos: pickedUtxos,
            uncompliantDepositIds: uncompliantIds.map(id => BigInt(id)),
            uncompliantAmounts: uncompliantIds.map(id => amountById.get(BigInt(id)) ?? 0n)
        });
    }
    if (!outputs.length) {
        throw new Error('cannot cover amount with selected utxos.');
    }
    return outputs;
};
// Build inputs/outputs for a single withdraw without proof generation.
export const buildWithdrawInputsOutputs = (token, chainId, keypair, inputs, withdrawAmount, isPublic = false) => {
    if (!inputs.utxos.length) {
        throw new Error(`No UTXOs found to cover withdrawal amount ${withdrawAmount}`);
    }
    // If we have uncompliant amounts, subtract them from the remainder.
    const uncompliantAmount = inputs.uncompliantAmounts?.reduce((a, b) => a + b, 0n) ?? 0n;
    const inputTotal = inputs.utxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
    const compliantAmount = inputTotal - uncompliantAmount;
    const isolatedAmount = isPublic ? compliantAmount : uncompliantAmount;
    const isolatedIds = isPublic ? inputs.compliantDepositIds : inputs.uncompliantDepositIds;
    const isolatedSubAmounts = isPublic ? inputs.compliantAmounts : inputs.uncompliantAmounts;
    // Change amount after subtracting the withdrawn amount and the uncompliant part,
    // because the uncompliant portion is isolated into its own output UTXO.
    const remainder = inputTotal - withdrawAmount - isolatedAmount;
    if (remainder < 0n) {
        throw new Error('withdraw amount exceeds input total');
    }
    const outputs = [];
    // Create the change UTXOs.
    if (remainder > 0n) {
        // Secure output UTXO for non-compliant content, and find Change UTXO space.
        const hasUncompliantOutput = Boolean(inputs.uncompliantDepositIds?.length) && uncompliantAmount > 0n;
        const maxChangeOutputs = MAX_STX_OUTPUT_UTXOS - (hasUncompliantOutput ? 1 : 0);
        // Calculate the subDeposit allocation for change.
        const changeAllocations = allocateWithdrawComponents(inputs, withdrawAmount, maxChangeOutputs, isPublic);
        const allocatedChangeAmount = changeAllocations.reduce((sum, allocation) => sum + allocation.subDepositAmounts.reduce((a, b) => a + b, 0n), 0n);
        if (allocatedChangeAmount !== remainder) {
            throw new Error(`Withdraw change mismatch: allocated=${allocatedChangeAmount}, remainder=${remainder}`);
        }
        // Create a change UTXO for each allocation and add it to the outputs.
        for (const allocation of changeAllocations) {
            const allocationAmount = allocation.subDepositAmounts.reduce((a, b) => a + b, 0n);
            outputs.push(new Utxo({
                token,
                chainId,
                keypair,
                amount: allocationAmount,
                subDepositIds: allocation.subDepositIds,
                subDepositAmounts: allocation.subDepositAmounts,
                type: UtxoType.Bogus
            }));
        }
    }
    // Isolate uncompliant or compliant deposit ids in one output UTXO based on isPublic flag.
    if (isolatedIds && isolatedAmount > 0n) {
        outputs.push(new Utxo({
            token,
            chainId,
            keypair,
            amount: isolatedAmount,
            subDepositIds: isolatedIds,
            subDepositAmounts: isolatedSubAmounts,
            type: UtxoType.Bogus
        }));
    }
    // Output UTXO count limit check.
    if (outputs.length > MAX_STX_OUTPUT_UTXOS) {
        throw new Error('withdraw requires too many output UTXOs');
    }
    return { inputs: inputs.utxos, outputs, uncompliantAmount };
};
// Decide how much to withdraw in this step and build corresponding inputs/outputs.
export const resolveWithdrawStep = (params, remainingAmount, inputCandidates, blacklist, chainId) => {
    const token = params.token.toLowerCase();
    const candidateAmounts = [];
    const seen = new Set();
    const addCandidate = (amount) => {
        if (amount <= 0n)
            return;
        const key = amount.toString();
        if (seen.has(key))
            return;
        seen.add(key);
        candidateAmounts.push(amount);
    };
    // First try the full remaining amount.
    addCandidate(remainingAmount);
    // Then try smaller amounts by dividing with preset factors.
    for (const divisor of WITHDRAW_STEP_DIVISORS) {
        let candidate = remainingAmount / divisor;
        if (candidate === 0n)
            candidate = 1n;
        addCandidate(candidate);
    }
    for (const stepAmount of candidateAmounts) {
        try {
            // Try candidate input sets in order.
            const candidates = selectWithdrawInputCandidates(inputCandidates, stepAmount, blacklist, params.isPublic ?? false);
            for (const picked of candidates) {
                try {
                    const built = buildWithdrawInputsOutputs(token, chainId, params.spender, picked, stepAmount, params.isPublic);
                    return { stepAmount, inputs: built.inputs, outputs: built.outputs };
                }
                catch (innerError) {
                    if (!isRetryableWithdrawSplitError(innerError))
                        throw innerError;
                }
            }
        }
        catch (error) {
            // Only fall back to smaller amounts for retryable errors.
            if (!isRetryableWithdrawSplitError(error))
                throw error;
        }
    }
    throw new Error(`Unable to progress withdraw amount (remaining=${remainingAmount})`);
};
//# sourceMappingURL=strategy.js.map