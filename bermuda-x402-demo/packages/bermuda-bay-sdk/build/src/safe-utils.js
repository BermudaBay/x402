import { Contract, getBytes, keccak256, recoverAddress, solidityPacked, toUtf8Bytes } from 'ethers';
import { OperationType } from './types.js';
import { bigint2bytes, bytes2bigint, concatBytes, hex, hex2bytes } from './utils.js';
// @safe-global/protocol-kit not needed in demo — stub signSafeTx only
function generateTypedData(_args) { throw new Error('Safe multisig not supported in this demo'); }
import SAFE_ABI from './abis/safe.abi.json' with { type: 'json' };
function adjustV(sig) {
    let v = Number(`0x${sig.slice(-2)}`);
    if (v < 27)
        v += 27; // min v for safe ecdsa
    return sig.slice(0, -2) + v.toString(16);
}
export async function isOwner(safeContract, signer) {
    if (!signer)
        return false;
    const owners = await safeContract.getOwners().then(owners => owners.map(o => o.toLowerCase()));
    return owners.includes(signer.toLowerCase());
}
export async function getSafeTxHash(safeContract, safeTx) {
    return safeContract.getTransactionHash(safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.nonce);
}
export async function signSafeTx(signer, safeAddress, safeTxData, chainId) {
    const safeContract = new Contract(safeAddress, SAFE_ABI, signer.provider);
    const safeVersion = await safeContract.VERSION();
    const safeEIP712Args = {
        safeAddress,
        safeVersion,
        chainId,
        data: safeTxData
    };
    const typedData = generateTypedData(safeEIP712Args);
    const { verifyingContract } = typedData.domain;
    const domain = { verifyingContract: verifyingContract, chainId: Number(chainId) };
    const signature = await signer.signTypedData(domain, typedData.primaryType === 'SafeMessage'
        ? { SafeMessage: typedData.types.SafeMessage }
        : { SafeTx: typedData.types.SafeTx }, typedData.message);
    return adjustV(signature);
}
export function readjustSignature(sig) {
    const v = Number(`0x${sig.slice(-2)}`);
    if (v === 31 || v === 32) {
        sig = sig.slice(0, -2) + (v - 4).toString(16);
    }
    return sig;
}
export function recoverSigner(safeTxHash, sig) {
    const v = Number(`0x${sig.slice(-2)}`);
    // If v==0 it is a contract sig else if v==1 it is a stored approved hash
    // In those cases the "signer" is encoded into the r signature component
    if (v === 0 || v === 1) {
        // The r component are the leading 32 bytes
        return `0x${sig.slice(26, 66)}`;
    }
    else if (v === 31 || v === 32) {
        // Adjust the hash by adding the "Ethereum Signed Message" prefix
        const adjustedHash = hex2bytes(keccak256(concatBytes(toUtf8Bytes(`\x19Ethereum Signed Message:\n32`), hex2bytes(safeTxHash))));
        // Readjust the signature's v component by -4
        const readjustedSig = readjustSignature(sig);
        return recoverAddress(adjustedHash, readjustedSig);
    }
    else {
        // Standard signature recovery
        return recoverAddress(hex2bytes(safeTxHash), sig);
    }
}
export function buildSignatureBytes(signatures) {
    const SIGNATURE_LENGTH_BYTES = 65;
    signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()));
    let signatureBytes = '0x';
    let dynamicBytes = '';
    for (const sig of signatures) {
        const v = Number('0x' + sig.data.slice(-2));
        if (v === 0) {
            // It is a contract signature
            /*
              A contract signature has a static part of 65 bytes and the dynamic part that needs to be appended
              at the end of signature bytes.
              The signature format is
              Signature type == 0
              Constant part: 65 bytes
              {32-bytes signature verifier}{32-bytes dynamic data position}{1-byte signature type}
              Dynamic part (solidity bytes): 32 bytes + signature data length
              {32-bytes signature length}{bytes signature data}
            */
            const dynamicPartPosition = (signatures.length * SIGNATURE_LENGTH_BYTES +
                dynamicBytes.length / 2)
                .toString(16)
                .padStart(64, '0');
            // Static part
            signatureBytes += `${sig.signer.slice(2).padStart(64, '0')}${dynamicPartPosition || ''}00`;
            // Dynamic part
            const dynamicPartLength = (sig.data.slice(2).length / 2).toString(16).padStart(64, '0');
            const dynamicPart = `${dynamicPartLength}${sig.data.slice(2)}`;
            dynamicBytes += dynamicPart;
        }
        else {
            signatureBytes += sig.data.slice(2);
        }
    }
    return signatureBytes + dynamicBytes;
}
function encodeMetaTransaction(tx) {
    if (!tx.to)
        throw Error('Missing safeTx.to');
    if (!tx.data)
        throw Error('Missing safeTx.data');
    const data = getBytes(tx.data);
    const encoded = solidityPacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [tx.operation ?? 0, tx.to, tx.value ?? 0n, BigInt(data.length), tx.data]);
    return encoded.slice(2);
}
export function encodeMultiSendData(txs) {
    return `0x${txs.map(encodeMetaTransaction).join('')}`;
}
export function hasDelegateCalls(txs) {
    return txs.some(tx => tx?.operation === OperationType.DelegateCall);
}
export function encodeStx(stx) {
    const buf = [stx.inputNullifiers.length, stx.outputCommitments.length];
    Array.prototype.push.apply(buf, Array.from(bigint2bytes(stx.root)));
    Array.prototype.push.apply(buf, Array.from(bigint2bytes(stx.publicAmount)));
    Array.prototype.push.apply(buf, Array.from(bigint2bytes(stx.extDataHash)));
    Array.prototype.push.apply(buf, Array.from(hex2bytes(stx.recipient)));
    Array.prototype.push.apply(buf, Array.from(bigint2bytes(stx.spendingLimit)));
    for (const n of stx.inputNullifiers)
        Array.prototype.push.apply(buf, Array.from(bigint2bytes(n)));
    for (const c of stx.outputCommitments) {
        Array.prototype.push.apply(buf, Array.from(bigint2bytes(c)));
    }
    return hex(Uint8Array.from(buf));
}
export function decodeStx(encodedStx) {
    const buf = hex2bytes(encodedStx);
    const inLen = buf[0];
    const outLen = buf[1];
    const baseLen = 2 + 4 * 32 + 20;
    const expectedLen = baseLen + (inLen + outLen) * 32;
    if (buf.length < expectedLen)
        throw Error('Encoded buffer too short');
    const root = bytes2bigint(buf.slice(2, 34));
    const publicAmount = bytes2bigint(buf.slice(34, 66));
    const extDataHash = bytes2bigint(buf.slice(66, 98));
    const recipient = hex(buf.slice(98, 118));
    const spendingLimit = bytes2bigint(buf.slice(118, 150));
    const inputNullifiers = [];
    const outputCommitments = [];
    let i = 150;
    for (let j = 0; j < inLen; j++, i += 32) {
        inputNullifiers[j] = bytes2bigint(buf.slice(i, i + 32));
    }
    for (let j = 0; j < outLen; j++, i += 32) {
        outputCommitments[j] = bytes2bigint(buf.slice(i, i + 32));
    }
    return {
        root,
        publicAmount,
        extDataHash,
        recipient,
        spendingLimit,
        inputNullifiers,
        outputCommitments
    };
}
//# sourceMappingURL=safe-utils.js.map