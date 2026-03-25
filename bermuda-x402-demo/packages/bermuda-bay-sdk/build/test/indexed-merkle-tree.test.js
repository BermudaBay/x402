import 'mocha';
import { expect } from 'chai';
import { IndexedMerkleTree, verifyExclusionProofs } from '../src/indexed-merkle-tree.js';
describe('indexed-merkle-tree', () => {
    it('round trip', () => {
        const blacklistKeys = [10n, 30n, 50n];
        const myDepositIds = [1n, 25n, 49n, 60n];
        const height = 4;
        const tree = new IndexedMerkleTree(blacklistKeys, height);
        const proofs = tree.getExclusionProofs(myDepositIds);
        expect(verifyExclusionProofs(myDepositIds, proofs, tree.root)).to.equal(true);
    });
    it('should insert correctly', () => {
        const blacklistKeys = [10n, 30n, 50n];
        const newKey = 60n;
        const height = 4;
        const tree = new IndexedMerkleTree(blacklistKeys, height);
        tree.insert(newKey);
        const allKeys = [10n, 30n, 50n, 60n];
        const newTree = new IndexedMerkleTree(allKeys, height);
        expect(tree.root).to.equal(newTree.root);
    });
});
//# sourceMappingURL=indexed-merkle-tree.test.js.map