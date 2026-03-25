import { AbiCoder, Interface, getAddress, keccak256 } from 'ethers';
import { streamXOR } from '@stablelib/xchacha20';
import { concatBytes, randomBytes } from './utils.js';
import { relay } from './relay.js';
const SAFE_MSG_CIPHERTEXT_ABI = ['function messageCiphertext(bytes32 topic, bytes ciphertext)'];
const SAFE_MSG_CIPHERTEXT_IFACE = new Interface(SAFE_MSG_CIPHERTEXT_ABI);
export const SAFE_MSG_CIPHERTEXT_NONCE_LENGTH = 24;
const KEY_LENGTH = 32;
const abiCoder = AbiCoder.defaultAbiCoder();
function normalizeSecretKey(secretKey) {
    if (!(secretKey instanceof Uint8Array)) {
        throw new Error('secretKey must be a Uint8Array');
    }
    if (secretKey.byteLength !== KEY_LENGTH) {
        throw new Error(`secretKey must be ${KEY_LENGTH} bytes`);
    }
    return secretKey;
}
export function encryptMessageCiphertext(secretKey, plaintext) {
    const key = normalizeSecretKey(secretKey);
    const nonce = randomBytes(SAFE_MSG_CIPHERTEXT_NONCE_LENGTH);
    const ciphertext = new Uint8Array(plaintext.length);
    streamXOR(key, nonce, plaintext, ciphertext);
    return {
        nonce,
        ciphertext,
        payload: concatBytes(nonce, ciphertext)
    };
}
export function decryptMessageCiphertext(secretKey, payload) {
    if (payload.length < SAFE_MSG_CIPHERTEXT_NONCE_LENGTH) {
        throw new Error('ciphertext payload too short');
    }
    const { nonce, ciphertext } = splitMessageCiphertextPayload(payload);
    const key = normalizeSecretKey(secretKey);
    const plaintext = new Uint8Array(ciphertext.length);
    streamXOR(key, nonce, ciphertext, plaintext);
    return plaintext;
}
export function splitMessageCiphertextPayload(payload) {
    if (payload.length < SAFE_MSG_CIPHERTEXT_NONCE_LENGTH) {
        throw new Error('ciphertext payload too short');
    }
    return {
        nonce: payload.slice(0, SAFE_MSG_CIPHERTEXT_NONCE_LENGTH),
        ciphertext: payload.slice(SAFE_MSG_CIPHERTEXT_NONCE_LENGTH)
    };
}
export function calcMessageCiphertextTopic(params) {
    const secretKey = normalizeSecretKey(params.secretKey);
    const encoded = abiCoder.encode(['uint256', 'address', 'bytes32'], [BigInt(params.chainId), getAddress(params.safeAddress), secretKey]);
    return keccak256(encoded);
}
export async function publishSafeMessageCiphertext(params) {
    const chainId = params.chainId;
    if (chainId === undefined || chainId === null) {
        throw new Error('chainId is required to publish the ciphertext');
    }
    const secretKey = normalizeSecretKey(params.secretKey);
    const encryptionPayload = encryptMessageCiphertext(secretKey, params.preimage);
    const topic = calcMessageCiphertextTopic({
        chainId,
        safeAddress: params.safeAddress,
        secretKey
    });
    const calldata = SAFE_MSG_CIPHERTEXT_IFACE.encodeFunctionData('messageCiphertext', [
        topic,
        encryptionPayload.payload
    ]);
    const result = {
        ...encryptionPayload,
        topic,
        calldata
    };
    if (params.viaRelayer === false) {
        return result;
    }
    const relayerEndpoint = params.relayer;
    if (!relayerEndpoint) {
        throw new Error('relayer endpoint is required');
    }
    const txHash = await relay(relayerEndpoint, {
        chainId,
        to: getAddress(params.signMessageHashLibAddress),
        data: calldata
    });
    return { ...result, txHash };
}
//# sourceMappingURL=safe-msg-ciphertext.js.map