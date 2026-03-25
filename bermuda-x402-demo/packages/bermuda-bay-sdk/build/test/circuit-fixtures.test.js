// This script generates fixtures for stx-circuit/transact/src/test.nr.
import { ZeroAddress } from 'ethers';
import { MerkleTree } from '../src/merkle-tree.js';
import KeyPair from '../src/keypair.js';
import Utxo from '../src/utxo.js';
import { BN254_FIELD_SIZE, bigint2bytes, getExtDataHash, hashUtxoNote, hex, MERKLE_TREE_DEFAULT_ZERO, poseidon2, STX_DEPOSIT_COMPONENTS, STX_DEPOSIT_ID_SLOTS, STX_INDEXED_LEVELS } from '../src/utils.js';
import { signatureToFields } from '../src/grumpkin-schnorr.js';
function computeMerkleRoot(levels, leaf, path, index) {
    const tree = new MerkleTree(levels, [], {
        hashFunction: poseidon2,
        zeroElement: MERKLE_TREE_DEFAULT_ZERO
    });
    const hash2 = (a, b) => tree.hashFunction?.(a, b) ?? poseidon2(a, b);
    let acc = leaf;
    for (let i = 0; i < levels; i++) {
        const bit = (index >> BigInt(i)) & 1n;
        const sibling = path[i];
        acc = (bit === 0n ? hash2(acc, sibling) : hash2(sibling, acc));
    }
    return acc;
}
function formatFieldArray(values) {
    return `[${values.map(v => v.toString()).join(', ')}]`;
}
function formatFieldMatrix(values) {
    return `[${values.map(v => formatFieldArray(v)).join(', ')}]`;
}
describe('circuit fixtures', () => {
    it('generates vectors for test_circuit', async () => {
        const CHAIN_ID = 0n;
        const LEVELS = 5;
        const N_INS = 2;
        const N_OUTS = 2;
        const N_DEPOSIT_COMPONENTS = STX_DEPOSIT_COMPONENTS;
        const N_DEPOSIT_ID_SLOTS = STX_DEPOSIT_ID_SLOTS;
        const INDEXED_LEVELS = STX_INDEXED_LEVELS;
        const depositId = 1n;
        const in_safe = [0n, 0n];
        const in_amount = [100000000000000000n, 0n];
        const in_blinding = [
            289184164427839320485306849001486046229521124595132064080744981764368187374n,
            356702006048331821443953090649120129330156729196723143421731616507451708350n
        ];
        const in_token = [
            1184589422945421143511828701991100965039074119625n,
            1184589422945421143511828701991100965039074119625n
        ];
        const in_path_indices = [1n, 0n];
        const in_path_elements = [
            [
                11400236893008971901885143124958521084356975869654317251799391654791837928021n,
                8995896153219992062710898675021891003404871425075198597897889079729967997688n,
                15126246733515326086631621937388047923581111613947275249184377560170833782629n,
                6404200169958188928270149728908101781856690902670925316782889389790091378414n,
                17903822129909817717122288064678017104411031693253675943446999432073303897479n
            ],
            [0n, 0n, 0n, 0n, 0n]
        ];
        const out_safe = [0n, 0n];
        const out_amount = [40000000000000000n, 60000000000000000n];
        const out_keypairs = [KeyPair.fromScalar(2n), KeyPair.fromScalar(3n)];
        const out_pubkey_hash = out_keypairs.map(kp => kp.pubkeyHash);
        const out_blinding = [
            345579407108627460644481188701062114034593599050047198764705599357632517673n,
            249017094180520992379219241055561384781249373505220481029720605701328279418n
        ];
        const out_token = [
            1184589422945421143511828701991100965039074119625n,
            1184589422945421143511828701991100965039074119625n
        ];
        const noteBytes = new Uint8Array([0]);
        const noteField = hashUtxoNote(noteBytes);
        const keypair = KeyPair.fromScalar(1n);
        const in_pubkey_x = Array(N_INS).fill(keypair.pubkeyX);
        const in_pubkey_y = Array(N_INS).fill(keypair.pubkeyY);
        const in_commitment = Array(N_INS).fill(0n);
        const in_nullifier = Array(N_INS).fill(0n);
        const in_nullifier_signature = Array(N_INS).fill(new Uint8Array(64));
        const zeroSubComponents = Array(N_DEPOSIT_COMPONENTS).fill(0n);
        const in_sub_deposit_ids = [];
        const in_sub_deposit_amounts = [];
        for (let i = 0; i < N_INS; i++) {
            const subDepositIds = [...zeroSubComponents];
            const subDepositAmounts = [...zeroSubComponents];
            if (in_amount[i] !== 0n) {
                subDepositIds[0] = depositId;
                subDepositAmounts[0] = in_amount[i];
            }
            in_sub_deposit_ids.push(subDepositIds);
            in_sub_deposit_amounts.push(subDepositAmounts);
            const tokenBytes = bigint2bytes(in_token[i], new Uint8Array(20));
            const safeBytes = bigint2bytes(in_safe[i], new Uint8Array(20));
            const utxoIn = new Utxo({
                amount: in_amount[i],
                blinding: in_blinding[i],
                keypair,
                chainId: CHAIN_ID,
                token: tokenBytes,
                safe: safeBytes,
                note: noteBytes,
                index: in_path_indices[i],
                subDepositIds,
                subDepositAmounts
            });
            in_commitment[i] = utxoIn.getCommitment();
            in_nullifier_signature[i] = await utxoIn.getNullifierSignature();
            in_nullifier[i] = await utxoIn.getNullifier();
        }
        const root = computeMerkleRoot(LEVELS, in_commitment[0], in_path_elements[0], in_path_indices[0]);
        const out_commitment = Array(N_OUTS).fill(0n);
        const encryptedOutputs = [];
        const out_sub_deposit_ids = [];
        const out_sub_deposit_amounts = [];
        for (let i = 0; i < N_OUTS; i++) {
            const subDepositIds = [...zeroSubComponents];
            const subDepositAmounts = [...zeroSubComponents];
            if (out_amount[i] !== 0n) {
                subDepositIds[0] = depositId;
                subDepositAmounts[0] = out_amount[i];
            }
            out_sub_deposit_ids.push(subDepositIds);
            out_sub_deposit_amounts.push(subDepositAmounts);
            const outKeyPair = out_keypairs[i];
            const tokenBytes = bigint2bytes(out_token[i], new Uint8Array(20));
            const safeBytes = bigint2bytes(out_safe[i], new Uint8Array(20));
            const utxoOut = new Utxo({
                amount: out_amount[i],
                blinding: out_blinding[i],
                keypair: outKeyPair,
                chainId: CHAIN_ID,
                token: tokenBytes,
                safe: safeBytes,
                note: noteBytes,
                subDepositIds,
                subDepositAmounts
            });
            out_commitment[i] = utxoOut.getCommitment();
            const encryptedOutput = utxoOut.encryptEphemeral
                ? await utxoOut.encrypt(undefined)
                : await utxoOut.encrypt(keypair);
            encryptedOutputs.push(hex(encryptedOutput.envelope));
        }
        const deposit_id_slots = Array(N_DEPOSIT_ID_SLOTS).fill(0n);
        deposit_id_slots[0] = depositId;
        const public_deposit_id_deltas = Array(N_DEPOSIT_ID_SLOTS).fill(0n);
        const compliance_signature = [0n, 0n, 0n, 0n];
        const compliance_deposit_id = 0n;
        const compliance_pubkey_x = 0n;
        const compliance_pubkey_y = 0n;
        const exclusion_root = 0n;
        const exclusion_leaf_keys = Array(N_DEPOSIT_ID_SLOTS).fill(0n);
        const exclusion_leaf_next_keys = Array(N_DEPOSIT_ID_SLOTS).fill(0n);
        const exclusion_path_indices = Array(N_DEPOSIT_ID_SLOTS).fill(0n);
        const exclusion_path_elements = Array.from({ length: N_DEPOSIT_ID_SLOTS }, () => Array(INDEXED_LEVELS).fill(0n));
        const inputs_nullifier_hash = poseidon2(...in_nullifier);
        const outputs_commitment_hash = poseidon2(...out_commitment);
        const fee = 0n;
        const sumIns = in_amount.reduce((sum, value) => sum + value, 0n);
        const sumOuts = out_amount.reduce((sum, value) => sum + value, 0n);
        const extAmount = fee + sumOuts - sumIns;
        const pubAmount = (extAmount - fee + BN254_FIELD_SIZE) % BN254_FIELD_SIZE;
        const recipient = hex(ZeroAddress, 20);
        const relayer = hex(ZeroAddress, 20);
        const funder = hex(ZeroAddress, 20);
        const deposit_funder = BigInt(funder);
        const extDataExtAmount = extAmount < 0n ? '-' + hex(extAmount, 32).replace('-', '') : hex(extAmount, 32);
        const extData = {
            recipient,
            extAmount: extDataExtAmount,
            relayer,
            fee: hex(fee, 32),
            encryptedOutputs,
            unwrap: false,
            token: extAmount === 0n ? ZeroAddress : hex(out_token[0], 20),
            nonce: hex(0n, 32),
            nonceKey: hex(0n, 32),
            funder
        };
        const extDataHash = getExtDataHash(extData);
        const transaction_message = poseidon2(CHAIN_ID, root, pubAmount, extDataHash, BigInt(recipient), 0n, inputs_nullifier_hash, outputs_commitment_hash);
        const transaction_message_bytes = bigint2bytes(transaction_message, new Uint8Array(32));
        const in_transaction_signature_bytes = Array(N_INS)
            .fill(null)
            .map(() => keypair.sign(transaction_message_bytes));
        const in_transaction_signature = in_transaction_signature_bytes.map(signatureToFields);
        const in_nullifier_signature_fields = in_nullifier_signature.map(signatureToFields);
        const in_nullifier_signature_e = in_nullifier_signature_fields.map(sig => sig[2] + (sig[3] << 128n));
        const lines = [
            `let root: Field = ${root};`,
            `let public_amount: Field = ${pubAmount};`,
            `let ext_data_hash: Field = ${extDataHash};`,
            `let challenge: Field = 0;`,
            `let recipient: Field = 0;`,
            `let deposit_funder: Field = ${deposit_funder};`,
            `let spending_limit: Field = 0;`,
            `let is_deposit: Field = 0;`,
            `let is_withdraw: Field = 0;`,
            `let deposit_id_slots: [Field; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldArray(deposit_id_slots)};`,
            `let public_deposit_id_deltas: [Field; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldArray(public_deposit_id_deltas)};`,
            `let compliance_signature: [Field; 4] = ${formatFieldArray(compliance_signature)};`,
            `let compliance_deposit_id: Field = ${compliance_deposit_id};`,
            `let compliance_pubkey_x: Field = ${compliance_pubkey_x};`,
            `let compliance_pubkey_y: Field = ${compliance_pubkey_y};`,
            `let exclusion_root: Field = ${exclusion_root};`,
            `let exclusion_leaf_keys: [Field; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldArray(exclusion_leaf_keys)};`,
            `let exclusion_leaf_next_keys: [Field; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldArray(exclusion_leaf_next_keys)};`,
            `let exclusion_path_indices: [Field; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldArray(exclusion_path_indices)};`,
            `let exclusion_path_elements: [[Field; ${INDEXED_LEVELS}]; ${N_DEPOSIT_ID_SLOTS}] = ${formatFieldMatrix(exclusion_path_elements)};`,
            `let in_nullifier: [Field; ${N_INS}] = ${formatFieldArray(in_nullifier)};`,
            `let in_safe: [Field; ${N_INS}] = ${formatFieldArray(in_safe)};`,
            `let in_amount: [Field; ${N_INS}] = ${formatFieldArray(in_amount)};`,
            `let in_pubkey_x: [Field; ${N_INS}] = ${formatFieldArray(in_pubkey_x)};`,
            `let in_pubkey_y: [Field; ${N_INS}] = ${formatFieldArray(in_pubkey_y)};`,
            `let in_transaction_signature: [[Field; 4]; ${N_INS}] = ${formatFieldMatrix(in_transaction_signature)};`,
            `let in_nullifier_signature: [[Field; 4]; ${N_INS}] = ${formatFieldMatrix(in_nullifier_signature_fields)};`,
            `let in_blinding: [Field; ${N_INS}] = ${formatFieldArray(in_blinding)};`,
            `let in_token: [Field; ${N_INS}] = ${formatFieldArray(in_token)};`,
            `let out_commitment: [Field; ${N_OUTS}] = ${formatFieldArray(out_commitment)};`,
            `let out_safe: [Field; ${N_OUTS}] = ${formatFieldArray(out_safe)};`,
            `let out_amount: [Field; ${N_OUTS}] = ${formatFieldArray(out_amount)};`,
            `let out_pubkey_hash: [Field; ${N_OUTS}] = ${formatFieldArray(out_pubkey_hash)};`,
            `let out_blinding: [Field; ${N_OUTS}] = ${formatFieldArray(out_blinding)};`,
            `let out_token: [Field; ${N_OUTS}] = ${formatFieldArray(out_token)};`,
            `let note_field: Field = ${noteField};`,
            `let in_note: [Field; ${N_INS}] = ${formatFieldArray(Array(N_INS).fill(noteField))};`,
            `let out_note: [Field; ${N_OUTS}] = ${formatFieldArray(Array(N_OUTS).fill(noteField))};`,
            `let in_path_indices: [Field; ${N_INS}] = ${formatFieldArray(in_path_indices)};`,
            `let in_path_elements: [[Field; ${LEVELS}]; ${N_INS}] = ${formatFieldMatrix(in_path_elements)};`,
            `let in_sub_deposit_ids: [[Field; ${N_DEPOSIT_COMPONENTS}]; ${N_INS}] = ${formatFieldMatrix(in_sub_deposit_ids)};`,
            `let in_sub_deposit_amounts: [[Field; ${N_DEPOSIT_COMPONENTS}]; ${N_INS}] = ${formatFieldMatrix(in_sub_deposit_amounts)};`,
            `let out_sub_deposit_ids: [[Field; ${N_DEPOSIT_COMPONENTS}]; ${N_OUTS}] = ${formatFieldMatrix(out_sub_deposit_ids)};`,
            `let out_sub_deposit_amounts: [[Field; ${N_DEPOSIT_COMPONENTS}]; ${N_OUTS}] = ${formatFieldMatrix(out_sub_deposit_amounts)};`,
            `// transaction_message: ${transaction_message};`,
            `// nullifier_signature_e: ${formatFieldArray(in_nullifier_signature_e)}`
        ];
        console.log(lines.join('\n'));
    });
});
//# sourceMappingURL=circuit-fixtures.test.js.map