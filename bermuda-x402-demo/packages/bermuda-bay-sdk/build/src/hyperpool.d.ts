import { IConfig, ITransactInputs, ITransactResult } from './types.js';
export default function init(config: IConfig): {
    transact({ pool, permit, ...rest }: ITransactInputs): Promise<ITransactResult>;
};
