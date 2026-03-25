import { Contract, getAddress } from 'ethers';
import V2_ROUTER_ABI from './abis/uniswapv2router.abi.json' with { type: 'json' };
export default function init(config) {
    return {
        async quoteExactInputSingle({ sellAmount, sellToken, buyToken }) {
            sellToken = getAddress(sellToken);
            buyToken = getAddress(buyToken);
            const router = new Contract(config.uniswapV2Router, V2_ROUTER_ABI, config.provider);
            const path = [sellToken, buyToken];
            // using "!" because .getAmountsOut() is guaranteed by the abi
            const amountsOut = await router.getAmountsOut(sellAmount, path);
            return amountsOut[1];
        },
        async quoteExactOutputSingle({ buyAmount, sellToken, buyToken }) {
            const router = new Contract(config.uniswapV2Router, V2_ROUTER_ABI, config.provider);
            const path = [sellToken, buyToken];
            // using "!" because .getAmountsIn() is guaranteed by the abi
            const amountsIn = await router.getAmountsIn(buyAmount, path);
            return amountsIn[0];
        }
    };
}
//# sourceMappingURL=uniswap.js.map