import { toUtf8Bytes, isHexString, getBytes, sha256 } from 'ethers';
import { concatBytes, BN254_FIELD_SIZE, I2OSP, OS2IP } from '../src/utils.js';
// strxor: XOR of equal-length byte strings
export function strxor(a, b) {
    if (a.length !== b.length)
        throw new Error('strxor: length mismatch');
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++)
        out[i] = a[i] ^ b[i];
    return out;
}
// toBytes: convert string or Uint8Array to Uint8Array
function toBytes(input) {
    if (input instanceof Uint8Array)
        return input;
    return isHexString(input) ? getBytes(input) : toUtf8Bytes(input);
}
// expandMessageXMD: expand a message to a uniform bytes
// Follow this specification section 5.3.1 of RFC 9380
// @param msg - Message to hash
// @param dst - Domain Separation Tag
// @param lenInBytes - Desired output length in bytes (max 65,535)
// @returns Uniform bytes of length lenInBytes
export function expandMessageXMD(msg, dst, lenInBytes) {
    const m = toBytes(msg);
    const dstBytes = toUtf8Bytes(dst);
    // SHA-256 output length
    const bInBytes = 32;
    // SHA-256 input block size
    const sInBytes = 64;
    // step 1.  ell = ceil(len_in_bytes / b_in_bytes)
    const ell = Math.ceil(lenInBytes / bInBytes);
    // step 2.  ABORT if ell > 255 or len_in_bytes > 65535 or len(DST) > 255
    if (ell > 255)
        throw new Error('expandMessageXMD: ell > 255');
    if (lenInBytes > Math.min(255 * bInBytes, 65535)) {
        throw new Error('expandMessageXMD: len_in_bytes too large');
    }
    if (dstBytes.length > 255) {
        throw new Error('expandMessageXMD: DST too long (>255 bytes)');
    }
    // step 3.  DST_prime = DST || I2OSP(len(DST), 1)
    const dstPrime = concatBytes(dstBytes, I2OSP(dstBytes.length, 1));
    // step 4.  Z_pad = I2OSP(0, s_in_bytes)
    const zPad = I2OSP(0, sInBytes);
    // step 5.  l_i_b_str = I2OSP(len_in_bytes, 2)
    const lenBytesStr = I2OSP(lenInBytes, 2);
    // step 6.  msg_prime = Z_pad || msg || l_i_b_str || I2OSP(0,1) || DST_prime
    const msgPrime = concatBytes(zPad, m, lenBytesStr, I2OSP(0, 1), dstPrime);
    // step 7.  b_0 = H(msg_prime)
    const b0 = getBytes(sha256(msgPrime));
    const blocks = new Array(ell);
    // step 8. b_1 = H(b_0 || I2OSP(1, 1) || DST_prime)
    blocks[0] = getBytes(sha256(concatBytes(b0, I2OSP(1, 1), dstPrime)));
    // step 9. for i in (2, ..., ell):
    // step 10. b_i = H(strxor(b0, b_(i-1)) || I2OSP(i,1) || DST_prime)
    for (let i = 2; i <= ell; i++) {
        const t = strxor(b0, blocks[i - 2]);
        blocks[i - 1] = getBytes(sha256(concatBytes(t, I2OSP(i, 1), dstPrime)));
    }
    // step 11. uniform_bytes = b_1 || ... || b_ell
    const uniformBytes = concatBytes(...blocks);
    // step 12. return substr(uniform_bytes, 0, len_in_bytes)
    return uniformBytes.slice(0, lenInBytes);
}
// hashToField: hash a message to multiple field elements
// Follow this specification section 5.2 of RFC 9380
// GF(p^m) — here we use the BN254 scalar field (prime field) so m = 1
// @param msg - Message to hash
// @param count - Number of field elements to generate
// @param dst - Domain Separation Tag
// @param p - Field size
// @param k - Security parameter
// @returns Array of count field elements in range [0, p-1]
export function hashToField(msg, count, dst, p = BN254_FIELD_SIZE, k = 128) {
    if (!Number.isInteger(count) || count <= 0) {
        throw new Error('hashToField: count must be a positive integer');
    }
    // L = ceil((ceil(log2(p)) + k)/8)
    const log2p = p.toString(2).length;
    const L = Math.ceil((log2p + k) / 8);
    // step 1. len_in_bytes = count * m * L
    // m = 1 so count * m = count
    const lenInBytes = count * L;
    // step 2. uniform_bytes = expand_message(msg, DST, len_in_bytes)
    const uniformBytes = expandMessageXMD(msg, dst, lenInBytes);
    const out = new Array(count);
    // step 3. for i in (0, ..., count - 1):
    for (let i = 0; i < count; i++) {
        // step 4. for j in (0, ..., m - 1):
        // (m = 1 so j = 0 only; no inner loop)
        // step 5. elm_offset = L * (j + i * m)
        // j=0, m=1, so elm_offset = L * i
        const elmOffset = L * i;
        // step 6. tv = substr(uniform_bytes, elm_offset, L)
        const tv = uniformBytes.slice(elmOffset, elmOffset + L);
        // step 7. e_j = OS2IP(tv) mod p
        const e0 = OS2IP(tv) % p;
        // step 8. u_i = (e_0, ..., e_(m - 1))
        // m=1, so u_i = (e_0)
        out[i] = e0;
    }
    // step 9. return (u_0, ..., u_(count - 1))
    return out;
}
// hashToFieldScalar: hash a message to a single field scalar
// Convenience function that calls hashToField with count=1 and ensures non-zero output
// Follow this specification section 5.2 of RFC 9380
// @param msg - Message to hash
// @param dst - Domain Separation Tag
// @param p - Field size
// @param k - Security parameter
// @returns Single field element in range [1, p-1] (guaranteed non-zero)
export function hashToFieldScalar(msg, dst, p = BN254_FIELD_SIZE, k = 128) {
    const [e0] = hashToField(msg, 1, dst, p, k);
    // if e0 is 0, return 1, otherwise return e0
    return e0 === 0n ? 1n : e0;
}
//# sourceMappingURL=hash-to-field.js.map