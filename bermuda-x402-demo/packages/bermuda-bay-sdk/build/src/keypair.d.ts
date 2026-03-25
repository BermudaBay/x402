import { IEncryptionKeyPair, ISealedEnvelope, IOpenedEnvelope, HexString, Hex32 } from './types.js';
export default class KeyPair {
    static readonly DST_SK_SPEND = "bermuda:sk_spend:v1";
    /** Spending sub key pair's private key. */
    privkey: bigint;
    /** Spending sub key hash: Poseidon2 of pubkey X/Y. */
    /** prefix of shielded address. */
    pubkeyHash: bigint;
    /** pubkey X/Y are required to verify Schnorr signatures in the circuit */
    /** Spending sub key pair's public key x coordinate. */
    pubkeyX?: bigint;
    /** Spending sub key pair's public key y coordinate. */
    pubkeyY?: bigint;
    /** Encryption sub key pair. */
    x25519: IEncryptionKeyPair;
    /**
     * Internal: build a KeyPair from a validated BN254 Fr scalar (0 < s < Fr).
     * Derives:
     *  - pubkeyHash = poseidon2(pubkeyX, pubkeyY)
     *  - x25519 from a deterministic seed
     *  - nonceKey = keccak256(x25519.secretKey), nonce = 0
     */
    private constructor();
    /**
     * Create a KeyPair from an explicit BN254 Fr scalar (no hashing).
     * @param scalar bigint or decimal/0x-hex string; must satisfy 0 < s < BN254_FIELD_SIZE (Fr)
     * @throws Error if scalar is out of range
     */
    static fromScalar(scalar: bigint | string): KeyPair;
    /**
     * Deterministically derive a KeyPair from a seed via hashToFieldScalar.
     * Same seed will always produce the same key.
     * @param seed Uint8Array | 0x-hex string | UTF-8 string
     */
    static fromSeed(seed: Uint8Array | string): KeyPair;
    /**
     * Generate a fresh random KeyPair: first CSPRNG 32B, then hashToFieldScalar.
     * Not deterministic (depends on randomness).
     */
    static random(): KeyPair;
    toString(): string;
    /**
     * Shielded address for this keypair, alias to {@link toString}
     * @dev Turning this into a getter will break our demo - be aware
     * @returns Shielded address
     */
    address(): string;
    /**
     *
     * Initialize a new keypair from an address string.
     * Alias to {@link fromString}
     *
     * @param shieldedAddress Shielded address
     * @returns Read-only key pair
     */
    static fromAddress(shieldedAddress: string): KeyPair;
    /**
     * Initialize a new keypair from an address string.
     * Omits secret keys and rather just provides the
     * spending and encryption public keys.
     *
     * @param shieldedAddress Shielded address
     * @returns Read-only key pair
     */
    static fromString(shieldedAddress: string): KeyPair;
    /**
     * Sign a message using the grumpkin Schnorr scheme.
     *
     * @param message 32-byte field element to sign
     * @returns Signature bytes (s||e)
     */
    sign(message: Uint8Array): Uint8Array;
    /**
     * Encrypt data using an ephemeral encryption key.
     *
     * @param buf Plaintext
     * @returns Encrypted enveloped data and a partial viewing key
     */
    encrypt(buf: Uint8Array): ISealedEnvelope;
    /**
     * Decrypt data using keypair private key
     *
     * @param buf an encrypted and authenticated envelope
     * @returns Plaintext and partial viewing key
     */
    decrypt(buf: Uint8Array): null | IOpenedEnvelope;
    /**
     * Prepares KeyPair object for JSON serialization.
     *
     * @returns Object used for JSON serialization.
     */
    toJSON(): Record<string, unknown>;
    /**
     * Turns serialized KeyPair object into KeyPair instance.
     *
     * @param json Parsed JSON value
     * @returns Initialized KeyPair instance.
     */
    static fromJSON(json: any): KeyPair;
}
export declare class SnapKeyPair {
    snapId: string;
    pubkeyX: bigint;
    pubkeyY: bigint;
    pubkeyHash: bigint;
    constructor(snapId?: string);
    init(): Promise<void>;
    invoke(method: string, params?: {
        [key: string]: any;
    }): Promise<any>;
    address(): Promise<HexString>;
    sign(message: Hex32): Promise<HexString>;
    encrypt(plaintext: HexString, recipient: HexString): Promise<HexString>;
    decrypt(ciphertext: HexString): Promise<null | HexString>;
}
