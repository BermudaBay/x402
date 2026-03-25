import { MerkleTree } from './merkle-tree.js';
import { Contract } from 'ethers';
import { IArgs, IConfig, ITransactProofPreimage, ITransactArtifacts, ITransactInputs, ISafeModule, IWithdrawArtifacts, IWithdrawProofPreimage, IPrepareOperation, IPublicWithdrawProofPreimage } from './types.js';
export default function init(config: IConfig, safeModule?: ISafeModule): {
    buildMerkleTree(pool?: Contract, fromBlock?: bigint, toBlock?: bigint, height?: number): Promise<MerkleTree>;
    prepareOperation(config: IConfig, safe: ISafeModule | undefined, transact: ITransactInputs): Promise<IPrepareOperation>;
    getTransactProof({ inputs, outputs, tree, extAmount, fee, recipient, spendingLimit, funder, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, zkStorageProof, zkStorageProofPublicInputs, complianceSignature, complianceDepositId, compliancePubkeyX, compliancePubkeyY, challenge, blockNumber, blockHash }: ITransactProofPreimage): Promise<IArgs>;
    getWithdrawProof({ inputs, outputs, tree, extAmount, fee, recipient, spendingLimit, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, exclusionRoot, exclusionLeafKeys, exclusionLeafNextKeys, exclusionPathIndices, exclusionPathElements, zkStorageProof, zkStorageProofPublicInputs, challenge, blockNumber, blockHash }: IWithdrawProofPreimage): Promise<IArgs>;
    getPublicWithdrawProof({ inputs, outputs, tree, extAmount, fee, recipient, spendingLimit, extData, stxHash, txKind, depositIdSlots, publicDepositIdDeltas, inclusionRoot, inclusionLeafNextKeys, inclusionPathIndices, inclusionPathElements, zkStorageProof, zkStorageProofPublicInputs, challenge, blockNumber, blockHash }: IPublicWithdrawProofPreimage): Promise<IArgs>;
    prepareTransact({ pool, inputs, outputs, fee, recipient, relayer, funder, unwrap, token, txKind, signer }: ITransactInputs): Promise<ITransactArtifacts>;
    prepareWithdraw({ pool, inputs, outputs, fee, recipient, relayer, funder, unwrap, token, txKind, signer }: ITransactInputs): Promise<IWithdrawArtifacts>;
    preparePublicWithdraw({ pool, inputs, outputs, fee, recipient, relayer, funder, unwrap, token, txKind, signer }: ITransactInputs): Promise<IWithdrawArtifacts>;
};
export declare const TRANSACT_ABI = "transact((bytes,bytes32[],bytes32,bytes32[],bytes32[],uint256,bytes32,bytes,bytes32[],bytes32,uint256,bytes32),(address,int256,address,uint256,bytes[],bool,address,address),(uint256,uint8,bytes32,bytes32),(string,uint256,address,bytes))";
