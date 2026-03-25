import 'mocha';
import { expect } from 'chai';
import { encryptMessageCiphertext, decryptMessageCiphertext, splitMessageCiphertextPayload, calcMessageCiphertextTopic, SAFE_MSG_CIPHERTEXT_NONCE_LENGTH } from '../src/safe-msg-ciphertext.js';
import KeyPair from '../src/keypair.js';
describe('safe-msg-ciphertext', () => {
    const secretKey = KeyPair.fromSeed('safe-msg-ciphertext-test').x25519.secretKey;
    const preimage = Buffer.from('safe-stx-preimage');
    it('encrypt/decrypt roundtrip', () => {
        const { nonce, ciphertext, payload } = encryptMessageCiphertext(secretKey, preimage);
        expect(nonce.byteLength).to.equal(SAFE_MSG_CIPHERTEXT_NONCE_LENGTH);
        expect(ciphertext.byteLength).to.equal(preimage.length);
        const decrypted = decryptMessageCiphertext(secretKey, payload);
        expect(Buffer.from(decrypted).equals(preimage)).to.equal(true);
    });
    it('split payload returns original nonce and ciphertext', () => {
        const { nonce, ciphertext, payload } = encryptMessageCiphertext(secretKey, preimage);
        const slices = splitMessageCiphertextPayload(payload);
        expect(Buffer.from(slices.nonce).equals(Buffer.from(nonce))).to.equal(true);
        expect(Buffer.from(slices.ciphertext).equals(Buffer.from(ciphertext))).to.equal(true);
    });
    it('computes a 32-byte topic from chain id, safe, and secret key', () => {
        const safeAddress = '0x1000000000000000000000000000000000000001';
        const topic = calcMessageCiphertextTopic({ chainId: 1n, safeAddress, secretKey });
        expect(topic).to.match(/^0x[0-9a-f]{64}$/);
    });
});
//# sourceMappingURL=safe-msg-ciphertext.test.js.map