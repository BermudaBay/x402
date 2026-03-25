import type { IMessageCiphertextPayload, IPublishSafeCiphertextParams, ISafeMessageCiphertextPublication, Hex32 } from './types.js';
export declare const SAFE_MSG_CIPHERTEXT_NONCE_LENGTH = 24;
export declare function encryptMessageCiphertext(secretKey: Uint8Array, plaintext: Uint8Array): IMessageCiphertextPayload;
export declare function decryptMessageCiphertext(secretKey: Uint8Array, payload: Uint8Array): Uint8Array;
export declare function splitMessageCiphertextPayload(payload: Uint8Array): {
    nonce: Uint8Array;
    ciphertext: Uint8Array;
};
export declare function calcMessageCiphertextTopic(params: {
    chainId: bigint | number;
    safeAddress: string;
    secretKey: Uint8Array;
}): Hex32;
export declare function publishSafeMessageCiphertext(params: IPublishSafeCiphertextParams): Promise<ISafeMessageCiphertextPublication>;
