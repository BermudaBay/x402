import { IEncryptionKeyPair, IOpenedEnvelope, ISealedEnvelope } from './types.js';
/**
 * Encrypts and authenticates a message with x25519-xchacha20-poly1305.
 *
 * @param senderKeyPair Curve25519 sender key pair
 * @param recipientPublicKey The public key of the message recipient
 * @param msg The plaintext message data
 * @returns Encrypted enveloped data xnonce:24,ephpubkey:32,ciphertext,tag:16 and a partial viewing key
 */
export declare function seal(senderKeyPair: IEncryptionKeyPair, recipientPublicKey: Uint8Array, msg: Uint8Array): ISealedEnvelope;
/**
 * Decrypts and authenticates a message with x25519-xchacha20-poly1305.
 *
 * @param keyPair Curve25519 key pair
 * @param msg The raw enrypted msg incl aad, ciphertext, and tag
 * @returns The opened envelope incl. plaintext and viewing key
 */
export declare function open(keyPair: IEncryptionKeyPair, msg: Uint8Array): null | IOpenedEnvelope;
/**
 * Shortcut open an envelope using a partial viewing key.
 *
 * @param viewingKey The partial viewing key
 * @param msg The raw enrypted msg incl aad, ciphertext, and tag.
 * @returns plaintext
 */
export declare function scopen(viewingKey: Uint8Array, msg: Uint8Array): null | Uint8Array;
