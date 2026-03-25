import 'mocha';
import { expect } from 'chai';
import { BN254_FIELD_SIZE, I2OSP, OS2IP } from '../src/utils.js';
import KeyPair from '../src/keypair.js';
import { strxor, expandMessageXMD, hashToField, hashToFieldScalar } from '../src/hash-to-field.js';
describe('RFC Utilities tests', () => {
    it('I2OSP/OS2IP roundtrip', () => {
        const v = 0x0123456789abcdefn;
        const os = I2OSP(v, 8);
        expect(os.length).to.equal(8);
        expect(OS2IP(os)).to.equal(v);
    });
    it('I2OSP throws on too-large integer', () => {
        expect(() => I2OSP(256n, 1)).to.throw();
    });
    it('strxor works with example numbers', () => {
        const a = new Uint8Array([0xaa, 0xf0]);
        const b = new Uint8Array([0xcc, 0x0f]);
        const x = strxor(a, b);
        expect([...x]).to.eql([0x66, 0xff]);
    });
});
describe('expand_message_xmd tests', () => {
    const MSG = 'hello';
    const DST = KeyPair.DST_SK_SPEND;
    it('returns exact length and is deterministic', () => {
        const n = 64;
        const a = expandMessageXMD(MSG, DST, n);
        const b = expandMessageXMD(MSG, DST, n);
        expect(a).to.be.instanceOf(Uint8Array);
        expect(a.length).to.equal(n);
        expect(Buffer.from(a).equals(Buffer.from(b))).to.equal(true);
    });
    it('changes when DST changes', () => {
        const n = 64;
        const a = expandMessageXMD(MSG, DST, n);
        const b = expandMessageXMD(MSG, DST + 'updated', n);
        expect(Buffer.from(a).equals(Buffer.from(b))).to.equal(false);
    });
});
describe('hash_to_field tests', () => {
    const MSG = 'hello';
    const DST = KeyPair.DST_SK_SPEND;
    it('returns elements in field range', () => {
        const elements = hashToField(MSG, 3, DST);
        expect(elements.length).to.equal(3);
        for (const element of elements) {
            expect(element >= 0n && element < BN254_FIELD_SIZE).to.equal(true);
        }
    });
    it('is deterministic for same input', () => {
        const a = hashToField(MSG, 2, DST);
        const b = hashToField(MSG, 2, DST);
        expect(a).to.eql(b);
    });
});
describe('hash_to_field_scalar tests', () => {
    const MSG = 'private-key-test';
    const DST = KeyPair.DST_SK_SPEND;
    it('returns elements in field range', () => {
        const element = hashToFieldScalar(MSG, DST);
        expect(element >= 1n && element < BN254_FIELD_SIZE).to.equal(true);
    });
    it('is deterministic for same input', () => {
        const a = hashToFieldScalar(MSG, DST);
        const b = hashToFieldScalar(MSG, DST);
        expect(a).to.equal(b);
    });
});
//# sourceMappingURL=hash-to-field.test.js.map