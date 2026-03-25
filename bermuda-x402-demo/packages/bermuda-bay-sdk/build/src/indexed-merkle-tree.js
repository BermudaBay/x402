import { MerkleTree } from './merkle-tree.js';
import { MERKLE_TREE_DEFAULT_ZERO, poseidon2 } from './utils.js';
// Deduplicate and sort keys
function sortUniqueKeys(keys) {
    const unique = new Set();
    for (const key of keys) {
        if (key > 0n) {
            unique.add(key);
        }
    }
    return Array.from(unique).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function computeMerkleRoot(leafHash, pathElements, pathIndex) {
    let current = leafHash;
    for (let i = 0; i < pathElements.length; i++) {
        const bit = (pathIndex >> BigInt(i)) & 1n;
        const left = bit === 0n ? current : pathElements[i];
        const right = bit === 0n ? pathElements[i] : current;
        current = poseidon2(left, right);
    }
    return current;
}
export function verifyExclusionProof(key, proof, expectedRoot) {
    if (key === 0n) {
        return false;
    }
    if (proof.leafKey >= key) {
        return false;
    }
    if (proof.leafNextKey !== 0n && key >= proof.leafNextKey) {
        return false;
    }
    if (proof.root !== expectedRoot) {
        return false;
    }
    const leafHash = poseidon2(proof.leafKey, proof.leafNextKey);
    const computedRoot = computeMerkleRoot(leafHash, proof.pathElements, proof.pathIndex);
    return computedRoot === expectedRoot;
}
export function verifyExclusionProofs(keys, proofs, expectedRoot) {
    if (proofs.root !== expectedRoot) {
        return false;
    }
    const count = keys.length;
    if (proofs.leafKeys.length !== count ||
        proofs.leafNextKeys.length !== count ||
        proofs.pathElements.length !== count ||
        proofs.pathIndices.length !== count) {
        return false;
    }
    for (let i = 0; i < count; i++) {
        const proof = {
            root: proofs.root,
            leafKey: proofs.leafKeys[i],
            leafNextKey: proofs.leafNextKeys[i],
            pathElements: proofs.pathElements[i],
            pathIndex: proofs.pathIndices[i]
        };
        if (!verifyExclusionProof(keys[i], proof, expectedRoot)) {
            return false;
        }
    }
    return true;
}
export function verifyInclusionProof(key, proof, expectedRoot) {
    if (key === 0n) {
        return false;
    }
    if (proof.leafKey !== key) {
        return false;
    }
    if (proof.root !== expectedRoot) {
        return false;
    }
    const leafHash = poseidon2(proof.leafKey, proof.leafNextKey);
    const computedRoot = computeMerkleRoot(leafHash, proof.pathElements, proof.pathIndex);
    return computedRoot === expectedRoot;
}
export class IndexedMerkleTree {
    height;
    leaves;
    tree;
    keyIndex;
    constructor(keys, height) {
        if (height <= 0) {
            throw new Error('height must be > 0');
        }
        this.height = height;
        const sortedKeys = sortUniqueKeys(keys);
        // Prepend the sentinel key
        const allKeys = [0n, ...sortedKeys];
        // Build [{key, nextKey},]
        this.leaves = allKeys.map((key, i) => ({
            key,
            nextKey: i + 1 < allKeys.length ? allKeys[i + 1] : 0n
        }));
        // Leaf hash = poseidon2(key, nextKey).
        const leafHashes = this.leaves.map(leaf => poseidon2(leaf.key, leaf.nextKey));
        const maxLeaves = 1 << height;
        if (leafHashes.length > maxLeaves) {
            throw new Error(`height ${height} is not enough for ${leafHashes.length} leaves`);
        }
        this.tree = new MerkleTree(height, leafHashes, {
            hashFunction: poseidon2,
            zeroElement: MERKLE_TREE_DEFAULT_ZERO
        });
        // Fast lookup from key -> leaf index.
        this.keyIndex = new Map();
        for (let i = 0; i < allKeys.length; i++) {
            this.keyIndex.set(allKeys[i], i);
        }
    }
    get root() {
        return this.tree.root;
    }
    insert(key) {
        if (key === 0n) {
            throw new Error('Key must be non-zero');
        }
        if (this.keyIndex.has(key)) {
            throw new Error(`Key already exists: ${key}`);
        }
        if (this.leaves.length >= this.tree.capacity) {
            throw new Error('Tree is full');
        }
        const predecessorIndex = this.findPredecessorIndex(key);
        const predecessor = this.leaves[predecessorIndex];
        const oldNextKey = predecessor.nextKey;
        predecessor.nextKey = key;
        const updatedPredecessorHash = poseidon2(predecessor.key, predecessor.nextKey);
        this.tree.update(predecessorIndex, updatedPredecessorHash);
        const newLeafIndex = this.leaves.length;
        const newLeaf = {
            key: key,
            nextKey: oldNextKey
        };
        this.leaves.push(newLeaf);
        this.keyIndex.set(key, newLeafIndex);
        const newLeafHash = poseidon2(newLeaf.key, newLeaf.nextKey);
        this.tree.update(newLeafIndex, newLeafHash);
    }
    getExclusionProof(key) {
        if (key === 0n) {
            throw new Error('key must be non-zero');
        }
        if (this.keyIndex.has(key)) {
            throw new Error(`key is already present: ${key}`);
        }
        // Exclusion proof is for the leaf.
        const index = this.findPredecessorIndex(key);
        return this.buildProofForLeafIndex(index);
    }
    getExclusionProofs(keys) {
        const proofs = keys.map(key => this.getExclusionProof(key));
        return {
            root: this.root,
            leafKeys: proofs.map(p => p.leafKey),
            leafNextKeys: proofs.map(p => p.leafNextKey),
            pathElements: proofs.map(p => p.pathElements),
            pathIndices: proofs.map(p => p.pathIndex)
        };
    }
    getInclusionProof(key) {
        if (key === 0n) {
            throw new Error('key must be non-zero');
        }
        const index = this.keyIndex.get(key);
        if (index === undefined)
            throw new Error(`key is not in the tree: ${key}`);
        return this.buildProofForLeafIndex(index);
    }
    getInclusionProofs(keys) {
        const proofs = keys.map(key => this.getInclusionProof(key));
        return {
            root: this.root,
            leafKeys: proofs.map(p => p.leafKey),
            leafNextKeys: proofs.map(p => p.leafNextKey),
            pathElements: proofs.map(p => p.pathElements),
            pathIndices: proofs.map(p => p.pathIndex)
        };
    }
    buildProofForLeafIndex(index) {
        const leaf = this.leaves[index];
        const path = this.tree.path(index);
        return {
            root: this.root,
            leafKey: leaf.key,
            leafNextKey: leaf.nextKey,
            pathElements: path.pathElements,
            pathIndex: BigInt(index)
        };
    }
    /// Binary search for the greatest leaf key < target key.
    findPredecessorIndex(key) {
        let lo = 0;
        let hi = this.leaves.length - 1;
        let ans = 0;
        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const midKey = this.leaves[mid].key;
            if (midKey < key) {
                ans = mid;
                lo = mid + 1;
            }
            else {
                hi = mid - 1;
            }
        }
        return ans;
    }
}
//# sourceMappingURL=indexed-merkle-tree.js.map