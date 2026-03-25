import 'mocha';
import { expect } from 'chai';
import Utxo from '../src/utxo.js';
import { mergeCommitmentEvents, mergeFindUtxosResults } from '../src/utils.js';
describe('utils', () => {
    describe('mergeFindUtxosResults', () => {
        it('merges results of findUtxos calls', () => {
            const utxo1 = new Utxo({ index: 1n, chainId: 1n });
            const utxo2 = new Utxo({ index: 2n, chainId: 1n });
            const utxo3 = new Utxo({ index: 3n, chainId: 1n });
            const utxo4 = new Utxo({ index: 4n, chainId: 1n });
            const utxo5 = new Utxo({ index: 5n, chainId: 1n });
            const utxo6 = new Utxo({ index: 6n, chainId: 1n });
            const a = {
                '0xa': [utxo1, utxo2],
                '0xb': [utxo3],
                '0xc': [utxo5]
            };
            const b = {
                '0xb': [utxo3, utxo4],
                '0xc': [utxo6]
            };
            const expected = {
                '0xa': [utxo1, utxo2],
                '0xb': [utxo3, utxo4],
                '0xc': [utxo5, utxo6]
            };
            const merged = mergeFindUtxosResults(a, b);
            expect(merged).to.deep.equal(expected);
        });
    });
    describe('mergeCommitmentEvents', () => {
        it('merges commitment events', () => {
            const comm1 = { index: 1n, commitment: '0x1c', encryptedOutput: '0x1e' };
            const comm2 = { index: 2n, commitment: '0x2c', encryptedOutput: '0x2e' };
            const comm3 = { index: 3n, commitment: '0x3c', encryptedOutput: '0x3e' };
            const comm4 = { index: 4n, commitment: '0x4c', encryptedOutput: '0x4e' };
            const comm5 = { index: 5n, commitment: '0x5c', encryptedOutput: '0x5e' };
            const a = [comm1, comm2, comm3];
            const b = [comm2, comm3, comm4, comm5];
            const expected = [comm1, comm2, comm3, comm4, comm5];
            const merged = mergeCommitmentEvents(a, b);
            expect(merged).to.deep.equal(expected);
        });
    });
});
//# sourceMappingURL=utils.test.js.map