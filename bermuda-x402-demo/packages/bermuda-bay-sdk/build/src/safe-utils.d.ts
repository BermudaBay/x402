import { Contract, Signer } from 'ethers';
import { EthAddress, Hex32, HexString, IStxHashParams, ISafeTx } from './types.js';
export declare function isOwner(safeContract: Contract, signer?: EthAddress): Promise<boolean>;
export declare function getSafeTxHash(safeContract: Contract, safeTx: ISafeTx): Promise<Hex32>;
export declare function signSafeTx(signer: Signer, safeAddress: string, safeTxData: ISafeTx, chainId: bigint): Promise<HexString>;
export declare function readjustSignature(sig: HexString): HexString;
export declare function recoverSigner(safeTxHash: Hex32, sig: HexString): EthAddress;
export declare function buildSignatureBytes(signatures: {
    data: HexString;
    signer: EthAddress;
}[]): string;
export declare function encodeMultiSendData(txs: Partial<ISafeTx>[]): string;
export declare function hasDelegateCalls(txs: Partial<ISafeTx>[]): boolean;
export declare function encodeStx(stx: IStxHashParams): string;
export declare function decodeStx(encodedStx: string): IStxHashParams;
