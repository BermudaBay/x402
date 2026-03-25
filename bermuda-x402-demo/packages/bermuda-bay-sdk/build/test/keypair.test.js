import 'mocha';
import { expect } from 'chai';
import { getBytes } from 'ethers';
import KeyPair from '../src/keypair.js';
import { BN254_FIELD_SIZE, SHIELDED_ADDRESS_PATTERN } from '../src/utils.js';
import { hashToFieldScalar } from '../src/hash-to-field.js';
describe('KeyPair', () => {
    const DST = KeyPair.DST_SK_SPEND;
    it('fromScalar: handles all input formats and validation', () => {
        const scalar = 123456789n;
        // Input format validation
        const kp1 = KeyPair.fromScalar(scalar);
        const kp2 = KeyPair.fromScalar(scalar.toString());
        const kp3 = KeyPair.fromScalar('0x' + scalar.toString(16));
        expect(kp1.privkey).to.equal(kp2.privkey);
        expect(kp1.privkey).to.equal(kp3.privkey);
        // Range validation
        expect(() => KeyPair.fromScalar(0n)).to.throw();
        expect(() => KeyPair.fromScalar(BN254_FIELD_SIZE)).to.throw();
        expect(() => KeyPair.fromScalar(1n)).to.not.throw();
        expect(() => KeyPair.fromScalar(BN254_FIELD_SIZE - 1n)).to.not.throw();
    });
    it('fromSeed: handles all input formats and produces deterministic results', () => {
        const seedA = '0x' + 'ab'.repeat(32);
        const seedB = '0x' + 'ac'.repeat(32);
        const seedC = 'test string';
        // Input format validation
        const kp1 = KeyPair.fromSeed(seedA);
        const kp2 = KeyPair.fromSeed(getBytes(seedA));
        expect(kp1.privkey).to.equal(kp2.privkey);
        // Deterministic behavior
        const a1 = KeyPair.fromSeed(seedA);
        const a2 = KeyPair.fromSeed(seedA);
        expect(a1.privkey).to.equal(a2.privkey);
        // Different seeds produce different keys
        const b1 = KeyPair.fromSeed(seedB);
        const c1 = KeyPair.fromSeed(seedC);
        expect(a1.privkey).to.not.equal(b1.privkey);
        expect(a1.privkey).to.not.equal(c1.privkey);
        // Matches hashToFieldScalar result
        const expA = hashToFieldScalar(seedA, DST);
        expect(a1.privkey).to.equal(expA);
    });
    it('random: within range and unlikely to duplicate', () => {
        const a = KeyPair.random();
        const b = KeyPair.random();
        expect(a.privkey > 0n && a.privkey < BN254_FIELD_SIZE).to.equal(true);
        expect(b.privkey > 0n && b.privkey < BN254_FIELD_SIZE).to.equal(true);
        expect(a.privkey).to.not.equal(b.privkey);
    });
    it('toString/fromString: roundtrip preserves only public information', () => {
        const kp = KeyPair.random();
        const addr = kp.toString();
        expect(SHIELDED_ADDRESS_PATTERN.test(addr)).to.equal(true);
        const ro = KeyPair.fromString(addr);
        expect(ro.privkey).to.equal(null);
        expect(ro.x25519.secretKey).to.equal(null);
        expect(ro.pubkeyHash).to.equal(kp.pubkeyHash);
        expect(Buffer.from(ro.x25519.publicKey).equals(Buffer.from(kp.x25519.publicKey))).to.equal(true);
    });
    it('should deserialize a default KeyPair instance from JSON', () => {
        const kp = KeyPair.random();
        const serialized = JSON.stringify(kp);
        const parsed = JSON.parse(serialized);
        const deserialized = KeyPair.fromJSON(parsed);
        expect(kp).to.deep.equal(deserialized);
    });
});
//# sourceMappingURL=keypair.test.js.map