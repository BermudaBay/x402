export declare function strxor(a: Uint8Array, b: Uint8Array): Uint8Array;
export declare function expandMessageXMD(msg: Uint8Array | string, dst: string, lenInBytes: number): Uint8Array;
export declare function hashToField(msg: Uint8Array | string, count: number, dst: string, p?: bigint, k?: number): bigint[];
export declare function hashToFieldScalar(msg: Uint8Array | string, dst: string, p?: bigint, k?: number): bigint;
