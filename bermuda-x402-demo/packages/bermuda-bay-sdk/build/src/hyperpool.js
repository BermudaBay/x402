import initCore from './core.js';
import { buildPermitTuple, hex, mapTransactArgs } from './utils.js';
export default function init(config) {
    const core = initCore(config);
    return {
        async transact({ pool, permit, ...rest }) {
            const { args, extData, viewingKey } = await core.prepareTransact({
                pool,
                ...rest
            });
            const [_args, _extData] = mapTransactArgs([args, extData]);
            const [deadline, v, r, s] = buildPermitTuple(permit);
            const gasOverrides = { gasLimit: 2300000 }; //1400000
            const txPromise = permit && permit.deadline
                ? pool.transact(_args, _extData, { deadline, v, r, s }, gasOverrides)
                : pool.transact(_args, _extData, gasOverrides);
            return txPromise
                .then((res) => config.provider.waitForTransaction(res.hash))
                .then((receipt) => {
                if (receipt.status === 0) {
                    console.error(receipt);
                    throw new Error('transact failed');
                }
                return { receipt, viewingKey: hex(viewingKey) };
            });
        }
    };
}
//# sourceMappingURL=hyperpool.js.map