import { isHexString, getBytes } from 'ethers';
import { curve25519Clamp, invokeSnap, poseidon2 } from './utils.js';
import * as x25519xchacha20poly1305 from './x25519-xchacha20-poly1305.js';
import { bigint2bytes, bytes2bigint, hex, randomBytes } from './utils.js';
import { BN254_FIELD_SIZE } from './utils.js';
import { hashToFieldScalar } from './hash-to-field.js';
import { computePublicKey, schnorrSign, STX_SPEND_AUTH_DOMAIN_FIELD } from './grumpkin-schnorr.js';
import { generateKeyPairFromSeed as curve25519Seed } from '@stablelib/x25519';
import { blake2s } from '@noble/hashes/blake2.js';
export default class KeyPair {
    // Domain separation tag for spending key derivation
    static DST_SK_SPEND = 'bermuda:sk_spend:v1';
    /** Spending sub key pair's private key. */
    privkey;
    /** Spending sub key hash: Poseidon2 of pubkey X/Y. */
    /** prefix of shielded address. */
    pubkeyHash;
    /** pubkey X/Y are required to verify Schnorr signatures in the circuit */
    /** Spending sub key pair's public key x coordinate. */
    pubkeyX;
    /** Spending sub key pair's public key y coordinate. */
    pubkeyY;
    /** Encryption sub key pair. */
    x25519;
    /**
     * Internal: build a KeyPair from a validated BN254 Fr scalar (0 < s < Fr).
     * Derives:
     *  - pubkeyHash = poseidon2(pubkeyX, pubkeyY)
     *  - x25519 from a deterministic seed
     *  - nonceKey = keccak256(x25519.secretKey), nonce = 0
     */
    constructor(privkey) {
        this.privkey = privkey;
        const privBytes = bigint2bytes(this.privkey, new Uint8Array(32));
        const pubkey = computePublicKey(privBytes);
        const pubkeyX = bytes2bigint(pubkey.x);
        const pubkeyY = bytes2bigint(pubkey.y);
        this.pubkeyX = pubkeyX;
        this.pubkeyY = pubkeyY;
        this.pubkeyHash = poseidon2(pubkeyX, pubkeyY);
        // Clamping the Curve25519 random seed to adjust to cofactor, see
        // https://cr.yp.to/ecdh.html "Computing secret keys".
        // Applying Blake2s to separate spending and viewing keys.
        // curve25519Seed only computes the pubkey, no modification of the seed.
        this.x25519 = curve25519Seed(curve25519Clamp(blake2s(privBytes)));
    }
    /**
     * Create a KeyPair from an explicit BN254 Fr scalar (no hashing).
     * @param scalar bigint or decimal/0x-hex string; must satisfy 0 < s < BN254_FIELD_SIZE (Fr)
     * @throws Error if scalar is out of range
     */
    static fromScalar(scalar) {
        const s = typeof scalar === 'bigint' ? scalar : BigInt(scalar);
        if (s <= 0n || s >= BN254_FIELD_SIZE) {
            throw new Error('Invalid BN254 Fr scalar: expected 1 <= s < BN254_FIELD_SIZE');
        }
        return new KeyPair(s);
    }
    /**
     * Deterministically derive a KeyPair from a seed via hashToFieldScalar.
     * Same seed will always produce the same key.
     * @param seed Uint8Array | 0x-hex string | UTF-8 string
     */
    static fromSeed(seed) {
        let bytes;
        if (seed instanceof Uint8Array)
            bytes = seed;
        else if (isHexString(seed))
            bytes = getBytes(seed);
        else
            bytes = new TextEncoder().encode(seed);
        const s = hashToFieldScalar(bytes, KeyPair.DST_SK_SPEND);
        return new KeyPair(s);
    }
    /**
     * Generate a fresh random KeyPair: first CSPRNG 32B, then hashToFieldScalar.
     * Not deterministic (depends on randomness).
     */
    static random() {
        return KeyPair.fromSeed(randomBytes(32));
    }
    toString() {
        return hex(this.pubkeyHash, 32) + hex(this.x25519.publicKey, 32).replace('0x', '');
    }
    /**
     * Shielded address for this keypair, alias to {@link toString}
     * @dev Turning this into a getter will break our demo - be aware
     * @returns Shielded address
     */
    /*get */ address() {
        return this.toString();
    }
    /**
     *
     * Initialize a new keypair from an address string.
     * Alias to {@link fromString}
     *
     * @param shieldedAddress Shielded address
     * @returns Read-only key pair
     */
    static fromAddress(shieldedAddress) {
        return KeyPair.fromString(shieldedAddress);
    }
    /**
     * Initialize a new keypair from an address string.
     * Omits secret keys and rather just provides the
     * spending and encryption public keys.
     *
     * @param shieldedAddress Shielded address
     * @returns Read-only key pair
     */
    static fromString(shieldedAddress) {
        shieldedAddress = shieldedAddress.replace('0x', '');
        if (shieldedAddress.length !== 128) {
            throw new Error('Invalid key length');
        }
        // Construct a read-only instance without private keys
        return Object.assign(Object.create(KeyPair.prototype), {
            privkey: null,
            pubkeyHash: BigInt('0x' + shieldedAddress.slice(0, 64)),
            pubkeyX: undefined,
            pubkeyY: undefined,
            x25519: {
                publicKey: getBytes('0x' + shieldedAddress.slice(64, 128)),
                secretKey: null
            },
            nonceKey: null,
            nonce: 0n
        });
    }
    /**
     * Sign a message using the grumpkin Schnorr scheme.
     *
     * @param message 32-byte field element to sign
     * @returns Signature bytes (s||e)
     */
    sign(message) {
        if (!this.privkey) {
            throw new Error('Can not sign without a private key');
        }
        const privBytes = bigint2bytes(this.privkey, new Uint8Array(32));
        return schnorrSign(message, privBytes, STX_SPEND_AUTH_DOMAIN_FIELD).signature;
    }
    /**
     * Encrypt data using an ephemeral encryption key.
     *
     * @param buf Plaintext
     * @returns Encrypted enveloped data and a partial viewing key
     */
    encrypt(buf) {
        const encryptionKeyPair = curve25519Seed(curve25519Clamp(randomBytes(32)));
        return x25519xchacha20poly1305.seal(encryptionKeyPair, this.x25519.publicKey, buf);
    }
    /**
     * Decrypt data using keypair private key
     *
     * @param buf an encrypted and authenticated envelope
     * @returns Plaintext and partial viewing key
     */
    decrypt(buf) {
        return x25519xchacha20poly1305.open(this.x25519, buf);
    }
    /**
     * Prepares KeyPair object for JSON serialization.
     *
     * @returns Object used for JSON serialization.
     */
    toJSON() {
        // Note that we only need to save the private key and nonce as we can
        // recompute everything else solely from the private key.
        return { privkey: hex(this.privkey) };
    }
    /**
     * Turns serialized KeyPair object into KeyPair instance.
     *
     * @param json Parsed JSON value
     * @returns Initialized KeyPair instance.
     */
    static fromJSON(json) {
        const privkey = BigInt(json.privkey);
        const keypair = new KeyPair(privkey);
        return keypair;
    }
}
export class SnapKeyPair {
    snapId;
    pubkeyX;
    pubkeyY;
    pubkeyHash;
    //NOTE SnapKeyPair instances must be initialized with await kp.init().
    constructor(snapId = 'local:http://localhost:8080') {
        this.snapId = snapId;
        this.pubkeyX = 0n;
        this.pubkeyY = 0n;
        this.pubkeyHash = 0n;
    }
    async init() {
        const pk = await this.invoke('spending_public_key');
        this.pubkeyX = BigInt(pk.x);
        this.pubkeyY = BigInt(pk.y);
        this.pubkeyHash = BigInt(pk.hash);
    }
    async invoke(method, params) {
        return invokeSnap({ snapId: this.snapId, method, params });
    }
    async address() {
        return this.invoke('shielded_address');
    }
    async sign(message) {
        return this.invoke('sign', { message });
    }
    async encrypt(plaintext, recipient) {
        return this.invoke('encrypt', { plaintext, recipient });
    }
    async decrypt(ciphertext) {
        return this.invoke('decrypt', { ciphertext });
    }
}
//# sourceMappingURL=keypair.js.map