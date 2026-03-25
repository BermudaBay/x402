import { IConfig, EthAddress, HexString, IGelatoRelayRawInputs, IGelatoSponsoredCallInputs } from './types.js';
export default function init(config: IConfig): {
    relayRaw({ target, data, feeToken, gasLimit }: IGelatoRelayRawInputs): Promise<HexString>;
    sponsoredCall(req: IGelatoSponsoredCallInputs): Promise<string>;
    relayFeeEstimate(feeToken: EthAddress, chainId?: number, transferNoteLength?: number): Promise<bigint>;
    getEstimatedFee({ chainId, feeToken, gasLimit, isHighPriority, gasLimitL1 }: any): Promise<bigint>;
};
