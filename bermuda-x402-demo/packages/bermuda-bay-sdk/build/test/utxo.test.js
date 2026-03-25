import 'mocha';
import { expect } from 'chai';
import Utxo from '../src/utxo.js';
import { STX_DEPOSIT_COMPONENTS } from '../src/utils.js';
describe('utxo', () => {
    describe('fromJSON', () => {
        it('should deserialize a default UTXO instance from JSON', () => {
            const utxo = new Utxo({ chainId: 1n });
            const serialized = JSON.stringify(utxo);
            const parsed = JSON.parse(serialized);
            const deserialized = Utxo.fromJSON(parsed);
            expect(utxo).to.deep.equal(deserialized);
        });
        it('should deserialize a customized UTXO instance from JSON', () => {
            const zeroComponents = Array(STX_DEPOSIT_COMPONENTS).fill(0n);
            const subDepositIds = [...zeroComponents];
            const subDepositAmounts = [...zeroComponents];
            subDepositIds[0] = 1000n;
            subDepositAmounts[0] = 42n;
            const utxo = new Utxo({
                amount: 42n,
                index: 12n,
                chainId: 1n,
                token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                safe: '0x5aFE3855358E112B5647B952709E6165e1c1eEEe',
                note: 'Hello, World!',
                subDepositIds,
                subDepositAmounts,
                encryptEphemeral: true,
                type: 1
            });
            const serialized = JSON.stringify(utxo);
            const parsed = JSON.parse(serialized);
            const deserialized = Utxo.fromJSON(parsed);
            expect(utxo).to.deep.equal(deserialized);
        });
    });
});
//# sourceMappingURL=utxo.test.js.map