import { ProofData } from '@aztec/bb.js';
import { InputMap } from '@noir-lang/noir_js';
import { IConfig } from './types.js';
export default function init(config: IConfig): {
    prove2x4(inputs: InputMap): Promise<ProofData>;
    prove4x4(inputs: InputMap): Promise<ProofData>;
    withdraw2x4(inputs: InputMap): Promise<ProofData>;
    withdraw4x4(inputs: InputMap): Promise<ProofData>;
    publicWithdraw2x4(inputs: InputMap): Promise<ProofData>;
    publicWithdraw4x4(inputs: InputMap): Promise<ProofData>;
};
