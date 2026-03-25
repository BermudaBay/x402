export declare const STX_SPEND_AUTH_DOMAIN_MESSAGE = "bermudabay:stx:spend-auth:schnorr:v1";
export declare function domainSeparatorFromMessage(message: string): bigint;
export declare const STX_SPEND_AUTH_DOMAIN_FIELD: bigint;
export type PublicKeyBytes = {
    x: Uint8Array;
    y: Uint8Array;
};
export type SignatureBytes = {
    s: Uint8Array;
    e: Uint8Array;
};
export type SignatureFields = [bigint, bigint, bigint, bigint];
export declare function computePublicKey(privateKey: Uint8Array): PublicKeyBytes;
export declare function schnorrSign(message: Uint8Array, privateKey: Uint8Array, domainSeparator: bigint): SignatureBytes & {
    signature: Uint8Array;
};
export declare function schnorrVerifySignature(message: Uint8Array, publicKey: PublicKeyBytes, signature: SignatureBytes | Uint8Array, domainSeparator: bigint): boolean;
export declare function signatureToFields(signature: SignatureBytes | Uint8Array): SignatureFields;
