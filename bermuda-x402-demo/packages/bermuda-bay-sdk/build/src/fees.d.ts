import { ICalcFeeEthValue, ICalcTokenAmount, IGetTokenEthValue, ICalcExecutionFee, ICalcExecutionCost } from './types';
/**
 * Calculates how many tokens are needed to cover the transaction's execution
 * cost.
 *
 * @param slippage The slippage expressed as a percentage in the range from 0 - 1.
 * @param executionFee The execution fee that's charged to process the transaction.
 * @param tokenEthValue The token's current value in ETH.
 * @returns The token amount.
 */
export declare function calcTokenAmount({ slippage, executionFee, tokenEthValue }: ICalcTokenAmount): number;
/**
 * Calculates the fee that's charged in ETH to execute the transaction.
 *
 * @param feeEthValue The expected fee amount in ETH.
 * @param executionCost The transaction's execution cost.
 * @returns The execution fee that's charged to process the transaction.
 */
export declare function calcExecutionFee({ feeEthValue, executionCost }: ICalcExecutionFee): bigint;
/**
 * Fetches realtime pricing data from CoW Swap to determine a token's ETH value.
 *
 * @param token The token to retrieve the ETH price for.
 * @param decimals The token's decimals.
 * @param amount The token amount.
 * @returns The token's current value in ETH.
 */
export declare function getTokenEthValue({ token, decimals, amount }: IGetTokenEthValue): Promise<bigint>;
/**
 * Calculates the execution cost of the transaction.
 *
 * @param to The transaction's `to` field.
 * @param data The transaction's `data` field.
 * @param provider The provider to be used.
 * @param value The transaction's (optional) `value` field.
 * @returns The transaction's execution cost.
 */
export declare function calcExecutionCost({ to, data, provider, value }: ICalcExecutionCost): Promise<bigint>;
/**
 * Calculates the expected fee amount in ETH.
 *
 * @param fee The fee expressed as a percentage in the range from 0 - 1.
 * @param executionCost The estimated cost to execute the transaction.
 * @returns The fee value in ETH.
 */
export declare function calcFeeEthValue({ fee, executionCost }: ICalcFeeEthValue): bigint;
/**
 * Creates the CoW Swap URL for fetching the native price of the respective
 * token.
 *
 * @param token The token to retrieve price information for.
 * @returns The CoW Swap API URL.
 */
export declare function getNativePriceURL(token: string): string;
