import 'mocha';
import { expect } from 'chai';
import { bytesToNumberBE, numberToBytesBE } from '@noble/curves/abstract/utils';
import KeyPair from '../src/keypair.js';
import { computePublicKey, schnorrSign, schnorrVerifySignature, STX_SPEND_AUTH_DOMAIN_FIELD, signatureToFields } from '../src/grumpkin-schnorr.js';
import { bigint2bytes } from '../src/utils.js';
describe('grumpkin-schnorr vector', () => {
    it('keypair sign is deterministic and verifies', () => {
        const kp = KeyPair.fromScalar(123456789n);
        const message = bigint2bytes(987654321n, new Uint8Array(32));
        const sig1 = kp.sign(message);
        const sig2 = kp.sign(message);
        expect(Buffer.from(sig1)).to.eql(Buffer.from(sig2));
        const pubkey = computePublicKey(bigint2bytes(kp.privkey, new Uint8Array(32)));
        expect(schnorrVerifySignature(message, pubkey, sig1, STX_SPEND_AUTH_DOMAIN_FIELD)).to.equal(true);
    });
    it('generates and verifies a fixed vector', () => {
        const messageBytes = new Uint8Array([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
            26, 27, 28, 29, 30, 31
        ]);
        const messageField = bytesToNumberBE(messageBytes);
        const privateKey = new Uint8Array(32);
        privateKey[31] = 1;
        const publicKey = computePublicKey(privateKey);
        const signature = schnorrSign(messageBytes, privateKey, STX_SPEND_AUTH_DOMAIN_FIELD);
        const isValid = schnorrVerifySignature(messageBytes, publicKey, signature.signature, STX_SPEND_AUTH_DOMAIN_FIELD);
        expect(isValid).to.equal(true);
        const expectedSignature = [
            3, 74, 251, 208, 217, 165, 117, 10, 65, 175, 251, 54, 156, 77, 198, 237, 196, 7, 219, 224,
            119, 41, 124, 70, 209, 137, 16, 98, 88, 181, 239, 181, 33, 238, 8, 194, 165, 38, 77, 105,
            118, 69, 13, 152, 223, 118, 231, 208, 53, 147, 228, 247, 251, 146, 137, 181, 199, 216, 217,
            221, 35, 206, 75, 221
        ];
        expect(Array.from(signature.signature)).to.eql(expectedSignature);
        const toHex = (bytes) => Buffer.from(bytes).toString('hex');
        const fieldToHex = (value) => `0x${toHex(numberToBytesBE(value, 32))}`;
        const toList = (bytes) => `[${Array.from(bytes).join(', ')}]`;
        console.log('message_field_hex:', fieldToHex(messageField));
        console.log('message_bytes:', toList(messageBytes));
        console.log('privkey_hex:', `0x${toHex(privateKey)}`);
        console.log('pubkey_x_hex:', `0x${toHex(publicKey.x)}`);
        console.log('pubkey_y_hex:', `0x${toHex(publicKey.y)}`);
        console.log('signature:', toList(signature.signature));
        console.log('signature_fields:', signatureToFields(signature.signature));
        console.log('domain_separator_field:', STX_SPEND_AUTH_DOMAIN_FIELD.toString());
    });
});
//# sourceMappingURL=grumpkin-schnorr.test.js.map