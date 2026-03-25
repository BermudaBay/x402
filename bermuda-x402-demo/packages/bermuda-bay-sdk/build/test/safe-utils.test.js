import 'mocha';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { encodeStx, decodeStx } from '../src/safe-utils.js';
describe('safe-utils', () => {
    describe('stx encoding', () => {
        const stx = {
            root: 1n,
            publicAmount: 2n,
            extDataHash: 3n,
            recipient: ZeroAddress,
            spendingLimit: 9n,
            inputNullifiers: [0n, 1n],
            outputCommitments: [2n, 3n]
        };
        it('should roundtrip encode/decode ', () => {
            expect(decodeStx(encodeStx(stx))).to.deep.equal(stx);
        });
    });
});
//# sourceMappingURL=safe-utils.test.js.map