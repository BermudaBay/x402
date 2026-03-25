import { toUtf8Bytes } from 'ethers';
import { randomBytes, bytes2bigint, bigint2bytes, hex2bytes, hex, concatBytes, ZERO_BYTES_20, STX_DEPOSIT_COMPONENTS, bytes2utf8 } from './utils.js';
import { poseidon2, hashUtxoNote } from './utils.js';
import KeyPair, { SnapKeyPair } from './keypair.js';
import { UtxoType } from './types.js';
export default class Utxo {
    /** Amount in atoms. */
    amount;
    /** Blinding factor as additional obfuscation layer. */
    blinding;
    /** The (possibly read-only) key pair of this UTXO's owner. */
    keypair;
    /** Index of the UTXO in the Merkle tree. */
    index;
    /** Token address in binary. */
    token;
    /** Human-readable note in binary. */
    note;
    /** Whether this UTXO shall be encrypted with an ephemeral encryption key pair. */
    encryptEphemeral;
    /** UTXO type identifier; necessary to reconstruct shielded transaction history. */
    type;
    /** Safe address if this UTXO is owned by a Safe. */
    safe;
    /** Deposit id components. */
    subDepositIds;
    /** Deposit amount components. */
    subDepositAmounts;
    /** Chain id for this UTXO. */
    chainId;
    /** UTXO commitment hash. */
    _commitment;
    /** UTXO nullifier hash. */
    _nullifier;
    /** nullifier signature bytes. */
    _nullifierSignature;
    /**
     * Initializes a new UTXO - unspent transaction output or input.
     * Note, a full TX consists of 2/16 inputs and 2 outputs.
     *
     * @param amount UTXO amount
     * @param blinding Blinding factor
     * @param keypair
     * @param token Token address
     * @param index UTXO index in the merkle tree
     * @param chainId Chain id for nullifier binding
     * @param safe Safe address
     * @param note Arbitrary note
     * @param encryptEphemeral Encrypt the utxo with an ephemeral x25519 keypair
     * @param type The utxo type
     * @dev note is set to void zero byte to prevent witness generation failure
     */
    constructor({ amount = 0n, keypair = KeyPair.random(), blinding = bytes2bigint(randomBytes(31)), index = 0n, chainId, token = ZERO_BYTES_20, safe = ZERO_BYTES_20, note = new Uint8Array([0]), subDepositIds, subDepositAmounts, encryptEphemeral = false, type = UtxoType.Bogus }) {
        this.amount = amount;
        this.blinding = blinding;
        this.keypair = keypair;
        this.index = index;
        this.chainId = chainId;
        this.token = token instanceof Uint8Array ? token : hex2bytes(token);
        this.note = note instanceof Uint8Array ? note : toUtf8Bytes(note);
        this.encryptEphemeral = encryptEphemeral;
        this.type = type;
        this.safe = safe instanceof Uint8Array ? safe : hex2bytes(safe);
        // Normalize optional sub-deposit components; zero-amount UTXOs may omit them.
        const zeroSubComponents = Array(STX_DEPOSIT_COMPONENTS).fill(0n);
        let normalizedSubDepositIds = subDepositIds ? [...subDepositIds] : undefined;
        let normalizedSubDepositAmounts = subDepositAmounts ? [...subDepositAmounts] : undefined;
        if (!normalizedSubDepositIds && !normalizedSubDepositAmounts) {
            if (this.amount === 0n) {
                normalizedSubDepositIds = [...zeroSubComponents];
                normalizedSubDepositAmounts = [...zeroSubComponents];
            }
            else {
                throw new Error('Missing deposit components for non-zero amount UTXO');
            }
        }
        const finalSubDepositIds = normalizedSubDepositIds ?? [...zeroSubComponents];
        const finalSubDepositAmounts = normalizedSubDepositAmounts ?? [...zeroSubComponents];
        if (finalSubDepositIds.length !== STX_DEPOSIT_COMPONENTS ||
            finalSubDepositAmounts.length !== STX_DEPOSIT_COMPONENTS) {
            throw new Error(`Invalid subDeposit component length; expected ${STX_DEPOSIT_COMPONENTS}, got ids=${finalSubDepositIds.length}, amounts=${finalSubDepositAmounts.length}`);
        }
        // Enforce component sum = amount to keep UTXO conservation explicit.
        const subAmountSum = finalSubDepositAmounts.reduce((sum, value) => sum + value, 0n);
        if (subAmountSum !== this.amount) {
            throw new Error('Sum of deposit components amounts must match the note amount');
        }
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            if (finalSubDepositAmounts[i] !== 0n && finalSubDepositIds[i] === 0n) {
                throw new Error('Deposit id required for non-zero deposit component');
            }
        }
        this.subDepositIds = finalSubDepositIds;
        this.subDepositAmounts = finalSubDepositAmounts;
        this._commitment = 0n;
        this._nullifier = 0n;
        this._nullifierSignature = null;
    }
    /**
     * Gets this UTXO's commitment hash.
     *
     * @returns Commitment hash
     */
    getCommitment() {
        if (!this._commitment) {
            const subDepositHash = poseidon2(...this.subDepositIds, ...this.subDepositAmounts);
            this._commitment = poseidon2(this.amount, this.keypair.pubkeyHash, this.blinding, bytes2bigint(this.token), bytes2bigint(this.safe), hashUtxoNote(this.note), subDepositHash);
        }
        return this._commitment;
    }
    /**
     * Gets this UTXO's nullifier hash.
     *
     * @returns Nullifier
     */
    async getNullifier() {
        if (!this._nullifier) {
            this.getNullifierSignature();
        }
        return this._nullifier;
    }
    /**
     * Gets this UTXO's nullifier signature bytes.
     *
     * @returns Signature bytes
     */
    async getNullifierSignature() {
        if (!this._nullifierSignature) {
            if (this.amount > 0n &&
                (this.index === undefined ||
                    this.index === null ||
                    (this.keypair instanceof KeyPair && !this.keypair.privkey))) {
                throw new Error('Can not compute nullifier without utxo index or private key');
            }
            const nullifierMessage = poseidon2(this.getCommitment(), BigInt(this.index), this.chainId);
            const nullifierMessageBytes = bigint2bytes(nullifierMessage, new Uint8Array(32));
            let signatureBytes;
            if (this.keypair instanceof SnapKeyPair) {
                signatureBytes = await this.keypair.sign(hex(nullifierMessageBytes)).then(hex2bytes);
            }
            else {
                signatureBytes = this.keypair.sign(nullifierMessageBytes);
            }
            const signatureE = bytes2bigint(signatureBytes.slice(32, 64));
            this._nullifier = poseidon2(this.getCommitment(), BigInt(this.index), signatureE);
            this._nullifierSignature = signatureBytes;
        }
        return this._nullifierSignature;
    }
    /**
     * Encrypt UTXO data using the current keypair
     *
     * @param {Uint8Array} spendingKeyPair Spending curve25519 key pair
     * @returns {string} `0x`-prefixed hex string with data
     */
    async encrypt(spendingKeyPair) {
        const subDepositBytes = this.subDepositIds.map(id => bigint2bytes(id, new Uint8Array(32)));
        const subAmountBytes = this.subDepositAmounts.map(amount => bigint2bytes(amount, new Uint8Array(31)));
        const bytes = concatBytes(bigint2bytes(this.amount, new Uint8Array(31)), bigint2bytes(this.blinding, new Uint8Array(31)), bigint2bytes(this.keypair.pubkeyHash), // defaults to 32 bytes
        this.token, // 20 bytes
        this.safe, // 20 bytes
        Uint8Array.from([this.type]), // 1 byte
        ...subDepositBytes, ...subAmountBytes, this.note // x bytes
        );
        if (spendingKeyPair instanceof SnapKeyPair) {
            const recipient = await this.keypair.address();
            const envelope = await spendingKeyPair.encrypt(hex(bytes), recipient).then(hex2bytes);
            return { envelope, viewingKey: new Uint8Array(32) };
        }
        else {
            if (this.keypair instanceof SnapKeyPair) {
                const recipient = await this.keypair.address();
                return KeyPair.fromAddress(recipient).encrypt(bytes);
            }
            else {
                return this.keypair.encrypt(bytes);
            }
        }
    }
    /**
     * Decrypts a UTXO.
     *
     * @param keypair keypair used to decrypt
     * @param data hex string with data
     * @param index UTXO index in merkle tree
     * @param chainId Chain id
     * @returns Decrypted UTXO and the corresponding viewing key
     */
    static async decrypt(keypair, data, index, chainId) {
        let openedEnvelope;
        if (keypair instanceof SnapKeyPair) {
            const pt = await keypair.decrypt(data);
            if (!pt)
                throw new Error('KeyPair: shkp-snap decryption failure');
            openedEnvelope = { plaintext: hex2bytes(pt), viewingKey: new Uint8Array(32) };
        }
        else {
            openedEnvelope = keypair.decrypt(hex2bytes(data));
        }
        if (!openedEnvelope) {
            throw new Error('KeyPair: decryption failure');
        }
        const { plaintext: buf, viewingKey } = openedEnvelope;
        const baseLen = 135;
        const subDepositLen = STX_DEPOSIT_COMPONENTS * 32;
        const subAmountLen = STX_DEPOSIT_COMPONENTS * 31;
        const minLen = baseLen + subDepositLen + subAmountLen;
        if (!buf || buf.length < minLen) {
            throw Error('Utxo: invalid encrypted payload length');
        }
        let offset = baseLen;
        const subDepositIds = [];
        const subDepositAmounts = [];
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            subDepositIds.push(bytes2bigint(buf.subarray(offset, offset + 32)));
            offset += 32;
        }
        for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
            subDepositAmounts.push(bytes2bigint(buf.subarray(offset, offset + 31)));
            offset += 31;
        }
        const owner = hex(buf.subarray(62, 94));
        const keypairAdrs = await keypair.address();
        const _keyPair = owner === keypairAdrs.slice(0, 66) ? keypair : KeyPair.fromString(owner + '0'.repeat(64));
        return {
            utxo: new Utxo({
                amount: bytes2bigint(buf.subarray(0, 31)),
                blinding: bytes2bigint(buf.subarray(31, 62)),
                keypair: _keyPair,
                token: buf.subarray(94, 114),
                safe: buf.subarray(114, 134),
                type: Number(buf[134]),
                subDepositIds,
                subDepositAmounts,
                note: buf.subarray(offset, buf.length),
                index,
                chainId
            }),
            viewingKey
        };
    }
    /**
     * Prepares UTXO object for JSON serialization.
     *
     * @returns Object used for JSON serialization
     */
    toJSON() {
        const note = bytes2utf8(this.note);
        return {
            amount: hex(this.amount),
            blinding: hex(this.blinding),
            keypair: this.keypair,
            index: hex(this.index),
            token: hex(this.token),
            note: note,
            encryptEphemeral: this.encryptEphemeral,
            type: this.type,
            safe: hex(this.safe),
            sub_deposit_ids: this.subDepositIds.map(id => hex(id)),
            sub_deposit_amounts: this.subDepositAmounts.map(amount => hex(amount)),
            chain_id: hex(this.chainId),
            _commitment: hex(this._commitment),
            _nullifier: hex(this._nullifier)
        };
    }
    /**
     * Turns serialized UTXO object into UTXO instance.
     *
     * @param json Parsed JSON value
     * @returns Initialized UTXO instance
     */
    static fromJSON(json) {
        const utxo = new Utxo({
            amount: BigInt(json.amount),
            blinding: BigInt(json.blinding),
            keypair: KeyPair.fromJSON(json.keypair),
            index: BigInt(json.index),
            chainId: BigInt(json.chain_id),
            token: json.token,
            note: json.note,
            encryptEphemeral: json.encryptEphemeral,
            type: json.type,
            safe: json.safe,
            subDepositIds: (json.sub_deposit_ids ?? []).map((id) => BigInt(id)),
            subDepositAmounts: (json.sub_deposit_amounts ?? []).map((amount) => BigInt(amount))
        });
        utxo._commitment = BigInt(json._commitment);
        utxo._nullifier = BigInt(json._nullifier);
        return utxo;
    }
}
//# sourceMappingURL=utxo.js.map