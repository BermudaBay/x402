export type HashFunction = (left: bigint, right: bigint) => string | bigint;
export interface MerklePath {
    pathElements: bigint[];
    pathIndices: number[];
    pathPositions: number[];
    pathRoot: bigint;
}
export declare const defaultHash: HashFunction;
export declare class MerkleTree {
    readonly levels: number;
    readonly zeroElement: bigint;
    private _hashFn;
    private _zeros;
    private _layers;
    constructor(levels: number, elements?: bigint[], options?: {
        hashFunction?: HashFunction;
        zeroElement?: bigint;
    });
    get capacity(): number;
    get layers(): bigint[][];
    get elements(): bigint[];
    get root(): bigint;
    get hashFunction(): HashFunction;
    indexOf(element: bigint, comparator?: (a: bigint, b: bigint) => boolean): number;
    /**
     * Insert new element into the tree
     * @param element Element to insert
     */
    insert(element: bigint): void;
    bulkInsert(elements: bigint[]): void;
    /**
     * Change an element in the tree
     * @param {number} index Index of element to change
     * @param element Updated element value
     */
    update(index: number, element: bigint): void;
    /**
     * Get merkle path to a leaf
     * @param {number} index Leaf index to generate path for
     * @returns {{pathElements: Object[], pathIndex: number[]}} An object containing adjacent elements and left-right index
     */
    path(index: number): {
        pathElements: bigint[];
        pathIndices: number[];
        pathPositions: number[];
        pathRoot: bigint;
    };
    private _buildZeros;
    private _processNodes;
    private _processUpdate;
    private _buildHashes;
    proof(element: bigint): MerklePath;
    getTreeEdge(edgeIndex: number): any;
    /**
     * 🪓
     * @param count
     */
    getTreeSlices(count?: number): any[];
    /**
     * Serialize entire tree state including intermediate layers into a plain object
     * Deserializing it back will not require to recompute any hashes
     * Elements are not converted to a plain type, this is responsibility of the caller
     */
    serialize(): {
        levels: number;
        _zeros: bigint[];
        _layers: bigint[][];
    };
    /**
     * Deserialize data into a MerkleTree instance
     * Make sure to provide the same hashFunction as was used in the source tree,
     * otherwise the tree state will be invalid
     */
    static deserialize(data: any, hashFunction?: HashFunction): MerkleTree;
}
