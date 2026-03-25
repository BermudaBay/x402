/**
 * Calculates how many tokens are needed to cover the transaction's execution
 * cost.
 *
 * @param slippage The slippage expressed as a percentage in the range from 0 - 1.
 * @param executionFee The execution fee that's charged to process the transaction.
 * @param tokenEthValue The token's current value in ETH.
 * @returns The token amount.
 */
export function calcTokenAmount({ slippage, executionFee, tokenEthValue }) {
    // Validate slippage.
    if (slippage < 0 || slippage > 1) {
        throw new Error('Fee must be in the range 0 to 1');
    }
    // The slippage needs to be rescaled since its expressed as a value between
    // 0 an 1.
    const scaledSlippage = BigInt(slippage * 100);
    // Calculate the amount slippage accounts for.
    const slippageAmount = (executionFee * scaledSlippage) / 100n;
    // Adjust the execution fee by incorporating the slippage.
    const adjustedExecutionFee = executionFee + slippageAmount;
    // We need to scale values so we don't lose precision (using 18 decimals here
    // as all values are expressed in wei).
    const scalingFactor = BigInt(10 ** 18);
    // token amount = adjusted execution fee / token ETH value
    const tokenAmount = Number((adjustedExecutionFee * scalingFactor) / tokenEthValue) / Number(scalingFactor);
    return tokenAmount;
}
/**
 * Calculates the fee that's charged in ETH to execute the transaction.
 *
 * @param feeEthValue The expected fee amount in ETH.
 * @param executionCost The transaction's execution cost.
 * @returns The execution fee that's charged to process the transaction.
 */
export function calcExecutionFee({ feeEthValue, executionCost }) {
    return executionCost + feeEthValue;
}
/**
 * Fetches realtime pricing data from CoW Swap to determine a token's ETH value.
 *
 * @param token The token to retrieve the ETH price for.
 * @param decimals The token's decimals.
 * @param amount The token amount.
 * @returns The token's current value in ETH.
 */
export async function getTokenEthValue({ token, decimals, amount }) {
    // Get ETH price for used token.
    // The API states that the "price is the exchange rate between the
    // specified token and the network's native currency. It represents
    // the amount of native token atoms needed to buy 1 atom of the
    // specified token."
    // Example: A "price" of 300_000_000.1234 for USDC means that to buy
    // 1 atom of USDC one needs to spend ~300_000_000 atoms of ETH (wei).
    // This translates to an ETH price of ~3000 USD.
    const url = getNativePriceURL(token);
    const res = await fetch(url);
    const { price: exchangeRate } = (await res.json());
    // We need to rescale the exchange rate so that it's represented in
    // wei. This can be done by multiplying the exchange rate by the
    // token's decimals.
    // Example: The exchange rate is 300_000_000.1234 and USDC has 6
    // decimals. To rescale the exchange rate we need to multiply it by
    // 10 ** 6 which results in 300_000_000_123_400 wei (or ~0.0003 ETH).
    const rescaledExchangeRate = BigInt(Math.round(exchangeRate * 10 ** decimals));
    // Given the rescaled exchange rate we can no multiply the "raw"
    // token amount with such exchange rate. We'll "overshoot" by doing
    // so, so we need to scale the result back by dividing it by the
    // token's decimals.
    // Example: We have 10 USDC which represented in atoms is 10_000_000.
    // The rescaled exchange rate for USDC is 300_000_000_123_400.
    // In ETH our USDC is therefore worth:
    //   (10_000_000 * 300_000_000_123_400) / 10 ** 6 wei
    // = 3_000_000_001_234_000                        wei
    // or ~0.003 ETH
    const tokenEthValue = (amount * rescaledExchangeRate) / BigInt(10 ** decimals);
    return tokenEthValue;
}
/**
 * Calculates the execution cost of the transaction.
 *
 * @param to The transaction's `to` field.
 * @param data The transaction's `data` field.
 * @param provider The provider to be used.
 * @param value The transaction's (optional) `value` field.
 * @returns The transaction's execution cost.
 */
export async function calcExecutionCost({ to, data, provider, value }) {
    // Estimate how much gas the transaction might consume.
    const gasUsed = await provider.estimateGas({
        to,
        data,
        value
    });
    // The execution cost in ETH denominated in wei is the current gas
    // price multiplied by the gas estimate.
    // Example: If it's estimated that the transaction takes 10_000_000
    // gas to execute and the current gas price is 100_000_000 wei
    // (0.1 gwei) then the total cost to execute it would be:
    //   10_000_000 * 100_000_000 wei
    // = 1_000_000_000_000_000    wei
    // or 0.001 ETH
    const { maxFeePerGas: gasPrice } = await provider.getFeeData();
    // We can use a type assertion for the `gasPrice` here as we're working with
    // chains that support EIP-1559.
    const executionCost = gasPrice * gasUsed;
    return executionCost;
}
/**
 * Calculates the expected fee amount in ETH.
 *
 * @param fee The fee expressed as a percentage in the range from 0 - 1.
 * @param executionCost The estimated cost to execute the transaction.
 * @returns The fee value in ETH.
 */
export function calcFeeEthValue({ fee, executionCost }) {
    // Validate fee.
    if (fee < 0 || fee > 1) {
        throw new Error('Fee must be in the range 0 to 1');
    }
    // Given that the fee is a float in the range from 0 - 1 we need to
    // scale it to its percentage value so we can represent it as a big
    // integer.
    // Example: If we have a 0.1 fee (a 10% fee), we'd rescale it by
    // multiplying the value by 100 as 0.1 * 100 = 10%.
    const scaledFee = BigInt(fee * 100);
    // Next we can calculate the fee by multiplying the execution cost
    // with the scaled fee and then scaling the result back by 100.
    // Example: The execution cost was calculated as
    // 1_000_000_000_000_000 wei and the fee is 10%. The fee's value in
    // wei would therefore be:
    //   1_000_000_000_000_000 * 10       wei
    // = 1_000_000_000_000_000 * 10 / 100 wei
    // = 100_000_000_000_000              wei
    // or 0.0001 ETH
    const feeEthValue = (executionCost * scaledFee) / 100n;
    return feeEthValue;
}
/**
 * Creates the CoW Swap URL for fetching the native price of the respective
 * token.
 *
 * @param token The token to retrieve price information for.
 * @returns The CoW Swap API URL.
 */
export function getNativePriceURL(token) {
    // TODO: Resolve chainId to network name so we don't solely use mainnet.
    // Prices should be the same because arbitrage, but it's more accurate to
    // fetch price data from the correct chain.
    return `https://api.cow.fi/mainnet/api/v1/token/${token}/native_price`;
}
//# sourceMappingURL=fees.js.map