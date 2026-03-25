import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { performance } from 'node:perf_hooks';
import { describe, it } from 'mocha';
import { MerkleTree } from '../src/merkle-tree.js';
import { IndexedMerkleTree } from '../src/indexed-merkle-tree.js';
import KeyPair from '../src/keypair.js';
import Utxo from '../src/utxo.js';
import { signatureToFields } from '../src/grumpkin-schnorr.js';
import { BN254_FIELD_SIZE, bigint2bytes, bytes2bigint, hashUtxoNote, hex, MERKLE_TREE_DEFAULT_ZERO, poseidon2, randomBytes, STX_DEPOSIT_COMPONENTS, STX_DEPOSIT_ID_SLOTS, STX_INDEXED_LEVELS } from '../src/utils.js';
const CHAIN_ID = 31337n;
const LEVELS = 23;
const NOTE_BYTES = new Uint8Array([0]);
const NOTE_FIELD = hashUtxoNote(NOTE_BYTES);
const TOKEN = 1n;
const SAFE = 0n;
const DEPOSIT_COMPONENTS = STX_DEPOSIT_COMPONENTS;
const DEPOSIT_ID_SLOTS = STX_DEPOSIT_ID_SLOTS;
const INDEXED_LEVELS = STX_INDEXED_LEVELS;
const CIRCUITS = [
    { name: 'transact2x4', nIns: 2, nOuts: 4 },
    { name: 'transact4x4', nIns: 4, nOuts: 4 }
];
const runBench = process.env.PROVE_BENCH === '1';
const TEST_TIMEOUT_MS = 10 * 60 * 1000;
if (runBench) {
    describe('prove timings', () => {
        it('measures witness/proof for each circuit and tx kind', async function () {
            this.timeout(TEST_TIMEOUT_MS);
            const kinds = ['deposit', 'transfer', 'withdraw'];
            for (const circuit of CIRCUITS) {
                const { noir, backend } = await loadCircuit(circuit.name);
                for (const kind of kinds) {
                    const inputs = await buildInput(circuit.nIns, circuit.nOuts, kind);
                    const witnessStart = performance.now();
                    const { witness } = await noir.execute(inputs);
                    const witnessEnd = performance.now();
                    const proofStart = performance.now();
                    await backend.generateProof(witness, { keccakZK: true });
                    const proofEnd = performance.now();
                    console.info(`[prove] ${circuit.name} ${kind} witness=${(witnessEnd - witnessStart).toFixed(1)}ms proof=${(proofEnd - proofStart).toFixed(1)}ms`);
                }
            }
        });
    });
}
else {
    describe.skip('prove timings', () => { });
}
async function loadCircuit(name) {
    const circuit = await import(`../src/circuits/31337/${name}.json`, {
        with: { type: 'json' }
    });
    const noir = new Noir(circuit.default);
    const backend = new UltraHonkBackend(circuit.default.bytecode, { threads: 1 });
    return { noir, backend };
}
function modField(value) {
    const mod = value % BN254_FIELD_SIZE;
    return mod < 0n ? mod + BN254_FIELD_SIZE : mod;
}
function buildComponents(amount, depositId) {
    const subDepositIds = new Array(DEPOSIT_COMPONENTS).fill(0n);
    const subDepositAmounts = new Array(DEPOSIT_COMPONENTS).fill(0n);
    if (amount > 0n) {
        subDepositIds[0] = depositId;
        subDepositAmounts[0] = amount;
    }
    return { subDepositIds, subDepositAmounts };
}
async function buildInput(nIns, nOuts, kind) {
    const tokenBytes = bigint2bytes(TOKEN, new Uint8Array(20));
    const safeBytes = bigint2bytes(SAFE, new Uint8Array(20));
    const keypair = KeyPair.fromScalar(1n);
    const depositId = 1n;
    const transferAmount = 1000000n;
    const inputAmounts = Array.from({ length: nIns }, () => 0n);
    const outputAmounts = Array.from({ length: nOuts }, () => 0n);
    if (kind === 'deposit') {
        outputAmounts[0] = transferAmount;
    }
    else if (kind === 'withdraw') {
        inputAmounts[0] = transferAmount;
    }
    else {
        inputAmounts[0] = transferAmount;
        outputAmounts[0] = transferAmount;
    }
    const inputs = [];
    for (let i = 0; i < nIns; i++) {
        const components = buildComponents(inputAmounts[i], depositId);
        inputs.push(new Utxo({
            amount: inputAmounts[i],
            blinding: bytes2bigint(randomBytes(31)),
            keypair,
            chainId: CHAIN_ID,
            token: tokenBytes,
            safe: safeBytes,
            note: NOTE_BYTES,
            index: BigInt(i),
            subDepositIds: components.subDepositIds,
            subDepositAmounts: components.subDepositAmounts
        }));
    }
    const outputs = [];
    for (let i = 0; i < nOuts; i++) {
        const components = buildComponents(outputAmounts[i], depositId);
        outputs.push(new Utxo({
            amount: outputAmounts[i],
            blinding: bytes2bigint(randomBytes(31)),
            keypair: KeyPair.fromScalar(BigInt(2 + i)),
            chainId: CHAIN_ID,
            token: tokenBytes,
            safe: safeBytes,
            note: NOTE_BYTES,
            subDepositIds: components.subDepositIds,
            subDepositAmounts: components.subDepositAmounts
        }));
    }
    const nullifierSignatureBytes = await Promise.all(inputs.map(input => input.getNullifierSignature()));
    const inNullifiers = await Promise.all(inputs.map(input => input.getNullifier()));
    const inputsNullifierHash = poseidon2(...inNullifiers);
    const outCommitments = outputs.map(output => output.getCommitment());
    const outputsCommitmentHash = poseidon2(...outCommitments);
    const tree = new MerkleTree(LEVELS, [], {
        hashFunction: poseidon2,
        zeroElement: MERKLE_TREE_DEFAULT_ZERO
    });
    let pathElements = Array.from({ length: LEVELS }, () => MERKLE_TREE_DEFAULT_ZERO);
    if (inputAmounts[0] > 0n) {
        tree.insert(inputs[0].getCommitment());
        pathElements = tree.path(0).pathElements;
    }
    const root = tree.root;
    const publicAmount = modField(outputAmounts.reduce((sum, value) => sum + value, 0n) -
        inputAmounts.reduce((sum, value) => sum + value, 0n));
    const extDataHash = 0n;
    const recipient = 0n;
    const spendingLimit = 0n;
    const stxHash = poseidon2(CHAIN_ID, root, publicAmount, extDataHash, recipient, spendingLimit, inputsNullifierHash, outputsCommitmentHash);
    const stxHashBytes = bigint2bytes(stxHash, new Uint8Array(32));
    const stxSig = signatureToFields(keypair.sign(stxHashBytes));
    const stxSigFields = stxSig.map(field => hex(field, 32));
    const inTransactionSignatures = Array.from({ length: nIns }, () => stxSigFields);
    const inNullifierSignatures = nullifierSignatureBytes.map(sig => signatureToFields(sig).map(field => hex(field, 32)));
    const depositIdSlots = Array(DEPOSIT_ID_SLOTS).fill(0n);
    depositIdSlots[0] = depositId;
    const publicDepositIdDeltas = Array(DEPOSIT_ID_SLOTS).fill(0n);
    if (kind === 'deposit' || kind === 'withdraw') {
        publicDepositIdDeltas[0] = publicAmount;
    }
    let exclusionRootValue = 0n;
    let exclusionLeafKeys = Array(DEPOSIT_ID_SLOTS).fill(0n);
    let exclusionLeafNextKeys = Array(DEPOSIT_ID_SLOTS).fill(0n);
    let exclusionPathIndices = Array(DEPOSIT_ID_SLOTS).fill(0n);
    let exclusionPathElements = Array.from({ length: DEPOSIT_ID_SLOTS }, () => Array.from({ length: INDEXED_LEVELS }, () => 0n));
    if (kind === 'withdraw') {
        const exclusionTree = new IndexedMerkleTree([], INDEXED_LEVELS);
        exclusionRootValue = exclusionTree.root;
        const proofs = exclusionTree.getExclusionProofs([depositId]);
        exclusionLeafKeys[0] = proofs.leafKeys[0];
        exclusionLeafNextKeys[0] = proofs.leafNextKeys[0];
        exclusionPathIndices[0] = proofs.pathIndices[0];
        exclusionPathElements[0] = proofs.pathElements[0];
    }
    let complianceSignature = [0n, 0n, 0n, 0n];
    let complianceDepositId = 0n;
    let compliancePubkeyX = 0n;
    let compliancePubkeyY = 0n;
    const depositFunder = kind === 'deposit' ? 0x1111111111111111111111111111111111111111n : 0n;
    if (kind === 'deposit') {
        complianceDepositId = depositId;
        compliancePubkeyX = keypair.pubkeyX;
        compliancePubkeyY = keypair.pubkeyY;
        const complianceMessageField = poseidon2(CHAIN_ID, TOKEN, publicAmount, complianceDepositId, outputsCommitmentHash, depositFunder);
        const complianceMessageBytes = bigint2bytes(complianceMessageField, new Uint8Array(32));
        complianceSignature = signatureToFields(keypair.sign(complianceMessageBytes));
    }
    const zeroPath = Array.from({ length: LEVELS }, () => MERKLE_TREE_DEFAULT_ZERO);
    const inPathElements = inputs.map((_, idx) => idx === 0 && inputAmounts[0] > 0n ? pathElements : zeroPath);
    const input = {
        root: hex(root, 32),
        public_amount: hex(publicAmount, 32),
        ext_data_hash: hex(extDataHash, 32),
        challenge: hex(0n, 32),
        recipient: hex(recipient, 32),
        spending_limit: hex(spendingLimit, 32),
        is_deposit: hex(kind === 'deposit' ? 1n : 0n, 32),
        is_withdraw: hex(kind === 'withdraw' ? 1n : 0n, 32),
        deposit_id_slots: depositIdSlots.map(value => hex(value, 32)),
        public_deposit_id_deltas: publicDepositIdDeltas.map(value => hex(value, 32)),
        compliance_signature: complianceSignature.map(value => hex(value, 32)),
        compliance_deposit_id: hex(complianceDepositId, 32),
        compliance_pubkey_x: hex(compliancePubkeyX, 32),
        compliance_pubkey_y: hex(compliancePubkeyY, 32),
        deposit_funder: hex(depositFunder, 32),
        exclusion_root: hex(exclusionRootValue, 32),
        exclusion_leaf_keys: exclusionLeafKeys.map(value => hex(value, 32)),
        exclusion_leaf_next_keys: exclusionLeafNextKeys.map(value => hex(value, 32)),
        exclusion_path_indices: exclusionPathIndices.map(value => hex(value, 32)),
        exclusion_path_elements: exclusionPathElements.map(row => row.map(value => hex(value, 32))),
        in_nullifier: inNullifiers.map(value => hex(value, 32)),
        in_safe: Array.from({ length: nIns }, () => hex(SAFE, 32)),
        in_amount: inputAmounts.map(value => hex(value, 32)),
        in_pubkey_x: Array.from({ length: nIns }, () => hex(keypair.pubkeyX, 32)),
        in_pubkey_y: Array.from({ length: nIns }, () => hex(keypair.pubkeyY, 32)),
        in_transaction_signature: inTransactionSignatures,
        in_nullifier_signature: inNullifierSignatures,
        in_blinding: inputs.map(input => hex(input.blinding, 32)),
        in_token: Array.from({ length: nIns }, () => hex(TOKEN, 32)),
        in_note: Array.from({ length: nIns }, () => hex(NOTE_FIELD, 32)),
        in_path_indices: inputs.map(input => hex(BigInt(input.index ?? 0n), 32)),
        in_path_elements: inPathElements.map(row => row.map(value => hex(value, 32))),
        in_sub_deposit_ids: inputs.map(input => input.subDepositIds.map(value => hex(value, 32))),
        in_sub_deposit_amounts: inputs.map(input => input.subDepositAmounts.map(value => hex(value, 32))),
        out_commitment: outCommitments.map(value => hex(value, 32)),
        out_safe: Array.from({ length: nOuts }, () => hex(SAFE, 32)),
        out_amount: outputAmounts.map(value => hex(value, 32)),
        out_pubkey_hash: outputs.map(output => hex(output.keypair.pubkeyHash, 32)),
        out_blinding: outputs.map(output => hex(output.blinding, 32)),
        out_token: Array.from({ length: nOuts }, () => hex(TOKEN, 32)),
        out_note: Array.from({ length: nOuts }, () => hex(NOTE_FIELD, 32)),
        out_sub_deposit_ids: outputs.map(output => output.subDepositIds.map(value => hex(value, 32))),
        out_sub_deposit_amounts: outputs.map(output => output.subDepositAmounts.map(value => hex(value, 32)))
    };
    return input;
}
//# sourceMappingURL=prove-timings.test.js.map