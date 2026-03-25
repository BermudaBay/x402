import { Field, mod } from '@noble/curves/abstract/modular';
import { numberToBytesBE, bytesToNumberBE, equalBytes } from '@noble/curves/abstract/utils';
import { weierstrassPoints } from '@noble/curves/abstract/weierstrass';
import { blake2s } from '@noble/hashes/blake2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { poseidon2 } from './utils.js';
import { hashToFieldScalar } from './hash-to-field.js';
// Grumpkin base field (BN254 scalar field).
const CURVE_P = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
// Grumpkin scalar field (BN254 base field).
const CURVE_N = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const CURVE_B = CURVE_P - 17n;
const CURVE_GX = 1n;
const CURVE_GY = 0x0000000000000002cf135e7506a45d632d270d45f1181294833fc48d823f272cn;
const grumpkin = weierstrassPoints({
    a: 0n,
    b: CURVE_B,
    Fp: Field(CURVE_P),
    n: CURVE_N,
    h: 1n,
    Gx: CURVE_GX,
    Gy: CURVE_GY
});
const GENERATOR = new grumpkin.ProjectivePoint(CURVE_GX, CURVE_GY, 1n);
// Domain separator for deterministic nonce k.
const NONCE_DOMAIN = utf8ToBytes('grumpkin-schnorr');
// Domain separator message for spend-auth Schnorr challenge.
export const STX_SPEND_AUTH_DOMAIN_MESSAGE = 'bermudabay:stx:spend-auth:schnorr:v1';
// Hash-to-field DST for Schnorr domain derivation.
const SCHNORR_DOMAIN_DST = 'bermudabay:schnorr-domain:v1';
export function domainSeparatorFromMessage(message) {
    return hashToFieldScalar(message, SCHNORR_DOMAIN_DST, CURVE_P);
}
// Domain separator for spend-auth Schnorr challenge.
export const STX_SPEND_AUTH_DOMAIN_FIELD = domainSeparatorFromMessage(STX_SPEND_AUTH_DOMAIN_MESSAGE);
// Compute public key. priv must be in the scalar field.
export function computePublicKey(privateKey) {
    const priv = normalizePrivateKey(privateKey);
    // P = xG
    const pub = GENERATOR.multiply(priv).toAffine();
    return {
        x: numberToBytesBE(pub.x, 32),
        y: numberToBytesBE(pub.y, 32)
    };
}
export function schnorrSign(message, privateKey, domainSeparator) {
    const priv = normalizePrivateKey(privateKey);
    // P = xG
    const pub = GENERATOR.multiply(priv).toAffine();
    const messageField = normalizeMessageField(message);
    const domainSeparatorField = normalizeDomainSeparator(domainSeparator);
    const messageBytes = numberToBytesBE(messageField, 32);
    // Derive deterministic nonce k.
    const privBytes = numberToBytesBE(priv, 32);
    const k = deriveDeterministicNonce(messageBytes, privBytes);
    // R = kG
    const r = GENERATOR.multiply(k).toAffine();
    // e = Poseidon2(R.x, P.x, P.y, messageField, domainSeparatorField)
    const challenge = poseidon2(r.x, pub.x, pub.y, messageField, domainSeparatorField);
    const eBytes = numberToBytesBE(challenge, 32);
    const eScalar = mod(challenge, CURVE_N);
    if (eScalar === 0n) {
        throw new Error('Invalid signature');
    }
    // s = k - x*e (mod n)
    const s = mod(k - priv * eScalar, CURVE_N);
    if (s === 0n) {
        throw new Error('Invalid signature');
    }
    const sBytes = numberToBytesBE(s, 32);
    return {
        s: sBytes,
        e: eBytes,
        signature: concatBytes(sBytes, eBytes)
    };
}
export function schnorrVerifySignature(message, publicKey, signature, domainSeparator) {
    const sig = normalizeSignature(signature);
    const sRaw = bytesToNumberBE(sig.s);
    if (sRaw >= CURVE_N) {
        return false;
    }
    const sScalar = mod(sRaw, CURVE_N);
    const eScalar = mod(bytesToNumberBE(sig.e), CURVE_N);
    if (sScalar === 0n || eScalar === 0n) {
        return false;
    }
    const pub = pointFromBytes(publicKey);
    const pubAffine = pub.toAffine();
    const messageField = normalizeMessageField(message);
    const domainSeparatorField = normalizeDomainSeparator(domainSeparator);
    // R' = sG + eP
    const r = GENERATOR.multiply(sScalar).add(pub.multiply(eScalar)).toAffine();
    // Challenge e' = Poseidon2(R'.x, P.x, P.y, messageField, domainSeparatorField)
    const challenge = poseidon2(r.x, pubAffine.x, pubAffine.y, messageField, domainSeparatorField);
    const expectedE = numberToBytesBE(challenge, 32);
    // e==e'
    return equalBytes(sig.e, expectedE);
}
// Convert signature bytes to field limbs: [s.lo, s.hi, e.lo, e.hi]
export function signatureToFields(signature) {
    const sig = normalizeSignature(signature);
    const sScalar = mod(bytesToNumberBE(sig.s), CURVE_N);
    const eScalar = mod(bytesToNumberBE(sig.e), CURVE_N);
    const [sLo, sHi] = splitScalar(sScalar);
    const [eLo, eHi] = splitScalar(eScalar);
    return [sLo, sHi, eLo, eHi];
}
// Derive nonce k in deterministic way
function deriveDeterministicNonce(message, privateKey) {
    let counter = 0;
    while (true) {
        const counterBytes = new Uint8Array([counter & 0xff]);
        const seed = concatBytes(NONCE_DOMAIN, privateKey, message, counterBytes);
        const hash = blake2s(seed);
        const k = mod(bytesToNumberBE(hash), CURVE_N);
        if (k !== 0n) {
            return k;
        }
        counter += 1;
    }
}
// Private key length check
function normalizePrivateKey(bytes) {
    if (bytes.length !== 32) {
        throw new Error('Private key must be 32 bytes.');
    }
    const scalar = mod(bytesToNumberBE(bytes), CURVE_N);
    if (scalar === 0n) {
        throw new Error('Private key must be non-zero.');
    }
    return scalar;
}
function normalizeMessageField(message) {
    if (message.length !== 32) {
        throw new Error('Message must be 32 bytes.');
    }
    const messageField = bytesToNumberBE(message);
    if (messageField >= CURVE_P) {
        throw new Error('Message must be a field element.');
    }
    return messageField;
}
function normalizeDomainSeparator(domainSeparator) {
    if (domainSeparator < 0n || domainSeparator >= CURVE_P) {
        throw new Error('Domain separator must be a field element.');
    }
    return domainSeparator;
}
// Signature(s, e) length check.
function normalizeSignature(signature) {
    if (signature instanceof Uint8Array) {
        if (signature.length !== 64) {
            throw new Error('Signature(s,e) must be 64 bytes.');
        }
        return { s: signature.subarray(0, 32), e: signature.subarray(32, 64) };
    }
    if (signature.s.length !== 32 || signature.e.length !== 32) {
        throw new Error('Both s, e must be 32 bytes.');
    }
    return signature;
}
function pointFromBytes(publicKey) {
    if (publicKey.x.length !== 32 || publicKey.y.length !== 32) {
        throw new Error('P.x, P.y must be 32 bytes.');
    }
    const point = new grumpkin.ProjectivePoint(bytesToNumberBE(publicKey.x), bytesToNumberBE(publicKey.y), 1n);
    // Checks it is not off-curve or infinity.
    point.assertValidity();
    return point;
}
function splitScalar(scalar) {
    const lo = scalar & ((1n << 128n) - 1n);
    const hi = scalar >> 128n;
    return [lo, hi];
}
//# sourceMappingURL=grumpkin-schnorr.js.map