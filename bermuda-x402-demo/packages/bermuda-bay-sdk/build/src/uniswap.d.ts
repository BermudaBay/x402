import { IConfig, IQuoteExactInputSingle, IQuoteExactOutputSingle } from './types.js';
export default function init(config: IConfig): {
    quoteExactInputSingle({ sellAmount, sellToken, buyToken }: IQuoteExactInputSingle): Promise<bigint>;
    quoteExactOutputSingle({ buyAmount, sellToken, buyToken }: IQuoteExactOutputSingle): Promise<any>;
};
