import 'mocha';
import { expect } from 'chai';
import KeyPair from '../src/keypair.js';
import { hex, hex2bytes } from '../src/utils.js';
describe('x25519-xchacha20-poly1305', () => {
    it('should encrypt using an ephemeral sender key pair', async () => {
        const plaintext = hex2bytes('0x4b0b');
        const bob = KeyPair.random();
        const bobAdrsOnly = KeyPair.fromString(bob.address());
        const eve = KeyPair.random();
        // Encrypt a msg for Bob using an ephemeral sender key pair.
        const { envelope } = bobAdrsOnly.encrypt(plaintext);
        // Bob decrypts.
        const bobPlaintext = await bob.decrypt(envelope)?.plaintext;
        expect(hex(bobPlaintext)).to.equal(hex(plaintext));
        // Eve tries to decrypt but fails.
        let eveResult = await eve.decrypt(envelope);
        expect(eveResult).to.be.null;
        eveResult = await eve.decrypt(envelope);
        expect(eveResult).to.be.null;
        eveResult = await eve.decrypt(envelope);
        expect(eveResult).to.be.null;
        eveResult = await eve.decrypt(envelope);
        expect(eveResult).to.be.null;
    });
});
//# sourceMappingURL=aead.test.js.map