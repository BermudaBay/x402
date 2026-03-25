import { randomBytes, concatBytes } from './utils.js';
import { blake2s } from '@noble/hashes/blake2.js';
import { PUBLIC_KEY_LENGTH, sharedKey as x25519 } from '@stablelib/x25519';
import { NONCE_LENGTH, KEY_LENGTH, XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';
/**
 * Encrypts and authenticates a message with x25519-xchacha20-poly1305.
 *
 * @param senderKeyPair Curve25519 sender key pair
 * @param recipientPublicKey The public key of the message recipient
 * @param msg The plaintext message data
 * @returns Encrypted enveloped data xnonce:24,ephpubkey:32,ciphertext,tag:16 and a partial viewing key
 */
export function seal(senderKeyPair, recipientPublicKey, msg) {
    // get a 192 bit nonce from a csprng
    const xnonce = randomBytes(NONCE_LENGTH);
    const aad = concatBytes(xnonce, 
    // the sender key is always ephemeral so we send it along in the aad
    senderKeyPair.publicKey);
    // doing x25519 - that is do diffie-hellman ontop of curve25519
    const rawSharedKey = x25519(senderKeyPair.secretKey, recipientPublicKey, true /*reject zero output*/);
    // rehashing the shared secret for use as key material
    const sharedKey = blake2s(rawSharedKey, { key: new Uint8Array(KEY_LENGTH) });
    // encrypt and authenticate
    const xchacha20poly1305 = new XChaCha20Poly1305(sharedKey);
    const ciphertextPlusTag = xchacha20poly1305.seal(xnonce, msg, aad);
    xchacha20poly1305.clean();
    rawSharedKey.fill(0x00);
    return {
        // xnonce:24,ephpubkey:32,ciphertext,tag:16
        envelope: concatBytes(aad, ciphertextPlusTag),
        viewingKey: sharedKey
    };
}
/**
 * Decrypts and authenticates a message with x25519-xchacha20-poly1305.
 *
 * @param keyPair Curve25519 key pair
 * @param msg The raw enrypted msg incl aad, ciphertext, and tag
 * @returns The opened envelope incl. plaintext and viewing key
 */
export function open(keyPair, msg) {
    const xnonce = msg.subarray(0, NONCE_LENGTH);
    const ephemeralPublicKey = msg.subarray(NONCE_LENGTH, NONCE_LENGTH + PUBLIC_KEY_LENGTH);
    const aad = concatBytes(xnonce, ephemeralPublicKey);
    const ciphertextPlusTag = msg.subarray(NONCE_LENGTH + PUBLIC_KEY_LENGTH, msg.length);
    let plaintext;
    // doing x25519 - that is do diffie-hellman ontop of curve25519
    const rawSharedKey = x25519(keyPair.secretKey, ephemeralPublicKey, true /*reject zero output*/);
    // rehashing the shared secret for use as key material
    const sharedKey = blake2s(rawSharedKey, { key: new Uint8Array(KEY_LENGTH) });
    rawSharedKey.fill(0x00);
    // authenticate and decrypt
    const xchacha20poly1305 = new XChaCha20Poly1305(sharedKey);
    plaintext = xchacha20poly1305.open(xnonce, ciphertextPlusTag, aad);
    xchacha20poly1305.clean();
    if (plaintext) {
        return {
            plaintext,
            viewingKey: sharedKey
        };
    }
    return null;
}
/**
 * Shortcut open an envelope using a partial viewing key.
 *
 * @param viewingKey The partial viewing key
 * @param msg The raw enrypted msg incl aad, ciphertext, and tag.
 * @returns plaintext
 */
export function scopen(viewingKey, msg) {
    const xnonce = msg.subarray(0, NONCE_LENGTH);
    const ephemeralPublicKey = msg.subarray(NONCE_LENGTH, NONCE_LENGTH + PUBLIC_KEY_LENGTH);
    const aad = concatBytes(xnonce, ephemeralPublicKey);
    const ciphertextPlusTag = msg.subarray(NONCE_LENGTH + PUBLIC_KEY_LENGTH, msg.length);
    const xchacha20poly1305 = new XChaCha20Poly1305(viewingKey);
    const plaintext = xchacha20poly1305.open(xnonce, ciphertextPlusTag, aad);
    xchacha20poly1305.clean();
    return plaintext || null;
}
//# sourceMappingURL=x25519-xchacha20-poly1305.js.map