import KeyPair, { SnapKeyPair } from './keypair.js';
import { HexString, IDecryptedUtxo, IRawUtxo, ISealedEnvelope, UtxoType } from './types.js';
export default class Utxo {
    /** Amount in atoms. */
    amount: bigint;
    /** Blinding factor as additional obfuscation layer. */
    blinding: bigint;
    /** The (possibly read-only) key pair of this UTXO's owner. */
    keypair: KeyPair | SnapKeyPair;
    /** Index of the UTXO in the Merkle tree. */
    index: bigint;
    /** Token address in binary. */
    token: Uint8Array;
    /** Human-readable note in binary. */
    note: Uint8Array;
    /** Whether this UTXO shall be encrypted with an ephemeral encryption key pair. */
    encryptEphemeral: boolean;
    /** UTXO type identifier; necessary to reconstruct shielded transaction history. */
    type: UtxoType;
    /** Safe address if this UTXO is owned by a Safe. */
    safe: Uint8Array;
    /** Deposit id components. */
    subDepositIds: bigint[];
    /** Deposit amount components. */
    subDepositAmounts: bigint[];
    /** Chain id for this UTXO. */
    chainId: bigint;
    /** UTXO commitment hash. */
    _commitment: bigint;
    /** UTXO nullifier hash. */
    _nullifier: bigint;
    /** nullifier signature bytes. */
    _nullifierSignature: Uint8Array | null;
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
    constructor({ amount, keypair, blinding, index, chainId, token, safe, note, subDepositIds, subDepositAmounts, encryptEphemeral, type }: IRawUtxo);
    /**
     * Gets this UTXO's commitment hash.
     *
     * @returns Commitment hash
     */
    getCommitment(): bigint;
    /**
     * Gets this UTXO's nullifier hash.
     *
     * @returns Nullifier
     */
    getNullifier(): Promise<bigint>;
    /**
     * Gets this UTXO's nullifier signature bytes.
     *
     * @returns Signature bytes
     */
    getNullifierSignature(): Promise<Uint8Array>;
    /**
     * Encrypt UTXO data using the current keypair
     *
     * @param {Uint8Array} spendingKeyPair Spending curve25519 key pair
     * @returns {string} `0x`-prefixed hex string with data
     */
    encrypt(spendingKeyPair?: KeyPair | SnapKeyPair): Promise<ISealedEnvelope>;
    /**
     * Decrypts a UTXO.
     *
     * @param keypair keypair used to decrypt
     * @param data hex string with data
     * @param index UTXO index in merkle tree
     * @param chainId Chain id
     * @returns Decrypted UTXO and the corresponding viewing key
     */
    static decrypt(keypair: KeyPair | SnapKeyPair, data: HexString, index: bigint, chainId: bigint): Promise<IDecryptedUtxo>;
    /**
     * Prepares UTXO object for JSON serialization.
     *
     * @returns Object used for JSON serialization
     */
    toJSON(): Record<string, unknown>;
    /**
     * Turns serialized UTXO object into UTXO instance.
     *
     * @param json Parsed JSON value
     * @returns Initialized UTXO instance
     */
    static fromJSON(json: any): Utxo;
}
