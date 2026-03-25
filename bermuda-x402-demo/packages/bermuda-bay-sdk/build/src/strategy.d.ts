import Utxo from './utxo.js';
import KeyPair, { SnapKeyPair } from './keypair.js';
import type { IFindUtxosInputs, IFindUtxosResult, IFindUtxosUpToOutputs, ITransferParams, ITransferOptions, IWithdrawParams } from './types.js';
export declare const allocateDepositComponents: (amount: bigint, depositId: bigint, base?: Utxo) => {
    subDepositIds: any[];
    subDepositAmounts: any[];
};
export declare const allocateWithdrawComponents: (inputs: IFindUtxosUpToOutputs, withdrawAmount: bigint, maxChangeOutputs: number, isPublic?: boolean) => {
    subDepositIds: bigint[];
    subDepositAmounts: bigint[];
}[];
export declare const selectTransferInputCandidates: (inputCandidates: Utxo[], requestedAmount: bigint) => Utxo[];
export declare const allocateTransferOutputComponents: (inputs: Utxo[], outputSpecs: {
    amount: bigint;
    keypair: KeyPair | SnapKeyPair;
    type: number;
    requiresCompliant: boolean;
}[], maxOutputs: number, blacklist?: Set<bigint>) => {
    outputSpecs: {
        amount: bigint;
        keypair: KeyPair | SnapKeyPair;
        type: number;
    }[];
    outputComponents: {
        subDepositIds: bigint[];
        subDepositAmounts: bigint[];
    }[];
};
export declare const buildTransferInputsOutputs: (params: ITransferParams, inputs: Utxo[], chainId: bigint, options?: ITransferOptions, blacklist?: Set<bigint>) => {
    inputs: Utxo[];
    outputs: Utxo[];
    token: string;
};
export declare const subtractStepAmounts: (remainingAmounts: bigint[], stepAmounts: bigint[]) => void;
export declare const assertTransferBalance: (findUtxos: (args: IFindUtxosInputs) => Promise<IFindUtxosResult>, pool: IFindUtxosInputs["pool"], params: ITransferParams, token: string, requiredTotal: bigint) => Promise<Utxo[]>;
export declare const resolveTransferStep: (params: ITransferParams, baseRecipients: ITransferParams["recipients"], remainingAmounts: bigint[], inputCandidates: Utxo[], chainId: bigint, options?: ITransferOptions, blacklist?: Set<bigint>) => Promise<{
    stepAmounts: bigint[];
    inputs: Utxo[];
    outputs: Utxo[];
}>;
export declare const buildWithdrawInputsOutputs: (token: string, chainId: bigint, keypair: KeyPair | SnapKeyPair, inputs: IFindUtxosUpToOutputs, withdrawAmount: bigint, isPublic?: boolean) => {
    inputs: Utxo[];
    outputs: Utxo[];
    uncompliantAmount: bigint;
};
export declare const resolveWithdrawStep: (params: IWithdrawParams, remainingAmount: bigint, inputCandidates: Utxo[], blacklist: Set<bigint>, chainId: bigint) => {
    stepAmount: bigint;
    inputs: Utxo[];
    outputs: Utxo[];
};
