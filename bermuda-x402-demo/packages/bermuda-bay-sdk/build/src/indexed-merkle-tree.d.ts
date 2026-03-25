import { MerkleTree } from './merkle-tree.js';
import { IIndexedMerkleProof, IIndexedMerkleProofs } from './types.js';
interface IndexedMerkleLeaf {
    key: bigint;
    nextKey: bigint;
}
export declare function verifyExclusionProof(key: bigint, proof: IIndexedMerkleProof, expectedRoot: bigint): boolean;
export declare function verifyExclusionProofs(keys: bigint[], proofs: IIndexedMerkleProofs, expectedRoot: bigint): boolean;
export declare function verifyInclusionProof(key: bigint, proof: IIndexedMerkleProof, expectedRoot: bigint): boolean;
export declare class IndexedMerkleTree {
    readonly height: number;
    readonly leaves: IndexedMerkleLeaf[];
    readonly tree: MerkleTree;
    readonly keyIndex: Map<bigint, number>;
    constructor(keys: bigint[], height: number);
    get root(): bigint;
    insert(key: bigint): void;
    getExclusionProof(key: bigint): IIndexedMerkleProof;
    getExclusionProofs(keys: bigint[]): IIndexedMerkleProofs;
    getInclusionProof(key: bigint): IIndexedMerkleProof;
    getInclusionProofs(keys: bigint[]): IIndexedMerkleProofs;
    private buildProofForLeafIndex;
    private findPredecessorIndex;
}
export {};
