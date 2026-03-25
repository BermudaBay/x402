import { Contract, Provider, Signer, Signer as EthersSigner, TransactionReceipt, ContractTransactionResponse, Wallet } from 'ethers';
import { MerkleTree } from './merkle-tree.js';
import type KeyPair from './keypair.js';
import type Utxo from './utxo.js';
import { SnapKeyPair } from './keypair.js';
import { IndexedMerkleTree } from './indexed-merkle-tree.js';
export { InputMap } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { Account as ViemAccount, WalletClient as ViemWalletClient, WalletClient } from 'viem';
import { type ClientEvmSigner } from '@x402/evm';
export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
/** 0x-prefixed hex string with the number of chars being a power of 2. */
export type HexString = string;
/** 0x-prefixed hex string representing 32 bytes. */
export type Hex32 = string;
/** 20-byte 0x-prefixed hex string. */
export type EthAddress = string;
export type ProgressHandler = (desc: string) => void;
export type TxKind = 'deposit' | 'transfer' | 'withdraw' | 'publicWithdraw';
export interface ICircuitArtifacts {
    noir: Noir;
    backend: UltraHonkBackend;
}
export interface IEncryptionKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
export interface ISealedEnvelope {
    envelope: Uint8Array;
    viewingKey: Uint8Array;
}
export interface IOpenedEnvelope {
    plaintext: Uint8Array;
    viewingKey: Uint8Array;
}
export interface IDecryptedUtxo {
    utxo: Utxo;
    viewingKey: Uint8Array;
}
export interface IBermudaPool {
    nonce(nonceKey: HexString): Promise<HexString>;
}
export interface IRawUtxo {
    amount?: bigint;
    keypair?: KeyPair | SnapKeyPair;
    blinding?: bigint;
    index?: bigint;
    chainId: bigint;
    token?: Uint8Array | EthAddress;
    safe?: Uint8Array | EthAddress;
    note?: Uint8Array | string;
    subDepositIds?: bigint[];
    subDepositAmounts?: bigint[];
    encryptEphemeral?: boolean;
    type?: number;
}
export interface ISharedProofPreimage extends IGenSharedInputs {
    zkStorageProof: HexString;
    zkStorageProofPublicInputs: HexString[];
    blockNumber: bigint;
    blockHash: HexString;
}
export interface ITransactProofPreimage extends ISharedProofPreimage {
    funder?: EthAddress;
    complianceSignature: bigint[];
    complianceDepositId: bigint;
    compliancePubkeyX: bigint;
    compliancePubkeyY: bigint;
}
export interface IWithdrawProofPreimage extends ISharedProofPreimage {
    exclusionRoot: bigint;
    exclusionLeafKeys: bigint[];
    exclusionLeafNextKeys: bigint[];
    exclusionPathIndices: bigint[];
    exclusionPathElements: bigint[][];
}
export interface IPublicWithdrawProofPreimage extends ISharedProofPreimage {
    inclusionRoot: bigint;
    inclusionLeafNextKeys: bigint[];
    inclusionPathIndices: bigint[];
    inclusionPathElements: bigint[][];
}
export interface IExtData {
    recipient: EthAddress;
    extAmount: HexString;
    relayer: EthAddress;
    fee: HexString;
    encryptedOutputs: HexString[];
    unwrap: boolean;
    token: EthAddress;
    nonce: HexString;
    nonceKey: HexString;
    funder: EthAddress;
}
export interface IDepositPermit {
    deadline: number | bigint;
    signature: HexString;
}
export interface IPermit {
    deadline: number | bigint;
    v: number;
    r: HexString;
    s: HexString;
}
export type PermitTuple = [deadline: bigint, v: number, r: HexString, s: HexString];
export interface IArgs {
    proof: HexString;
    publicInputs: HexString[];
    root: HexString;
    inputNullifiers: HexString[];
    outputCommitments: HexString[];
    publicAmount: HexString;
    extDataHash: HexString;
    zkStorageProof: HexString;
    zkStorageProofPublicInputs: HexString[];
    challenge: HexString;
    blockNumber: HexString;
    blockHash: HexString;
}
export interface ISharedCircuitInputArgs {
    root: HexString;
    public_amount: HexString;
    ext_data_hash: HexString;
    challenge: HexString;
    recipient: HexString;
    spending_limit: HexString;
    deposit_id_slots: HexString[];
    public_deposit_id_deltas: HexString[];
    in_nullifier: HexString[];
    in_safe: HexString[];
    in_amount: HexString[];
    in_pubkey_x: HexString[];
    in_pubkey_y: HexString[];
    in_transaction_signature: HexString[][];
    in_nullifier_signature: HexString[][];
    in_blinding: HexString[];
    in_token: HexString[];
    in_note: HexString[];
    in_path_indices: HexString[];
    in_path_elements: HexString[][];
    in_sub_deposit_ids: HexString[][];
    in_sub_deposit_amounts: HexString[][];
    out_commitment: HexString[];
    out_safe: HexString[];
    out_amount: HexString[];
    out_pubkey_hash: HexString[];
    out_blinding: HexString[];
    out_token: HexString[];
    out_note: HexString[];
    out_sub_deposit_ids: HexString[][];
    out_sub_deposit_amounts: HexString[][];
}
export interface IGenSharedInputs {
    inputs: Utxo[];
    outputs: Utxo[];
    tree: MerkleTree;
    extAmount: bigint;
    fee: bigint;
    recipient: EthAddress;
    spendingLimit: bigint;
    extData: IExtData;
    stxHash: bigint;
    txKind: TxKind;
    depositIdSlots: bigint[];
    publicDepositIdDeltas: bigint[];
    keyPair?: KeyPair | SnapKeyPair;
    challenge: HexString;
}
export interface IWithdrawArtifacts {
    args: IArgs;
    extData: IExtData;
    viewingKey: Uint8Array;
}
export interface ITransactArtifacts {
    args: IArgs;
    extData: IExtData;
    viewingKey: Uint8Array;
    complianceRequest: IComplianceManagerRequest | undefined;
}
export interface IIndexedMerkleInputs {
    keys: bigint[];
    depositIds: bigint[];
    height: number;
}
export interface IIndexedMerkleProof {
    root: bigint;
    leafKey: bigint;
    leafNextKey: bigint;
    pathElements: bigint[];
    pathIndex: bigint;
}
export interface IIndexedMerkleProofs {
    root: bigint;
    leafKeys: bigint[];
    leafNextKeys: bigint[];
    pathElements: bigint[][];
    pathIndices: bigint[];
}
export interface IPrepareOperation extends ISharedProofPreimage {
    netPublicAmount: bigint;
    viewingKey: Uint8Array;
    pubAmount: bigint;
    outputsCommitmentHash: bigint;
}
export interface ITransactInputs {
    pool?: any;
    inputs?: Utxo[];
    outputs?: Utxo[];
    fee?: bigint;
    recipient?: EthAddress;
    relayer?: EthAddress;
    funder?: EthAddress;
    unwrap?: boolean;
    token?: EthAddress;
    txKind: TxKind;
    signer?: AnySigner;
    permit?: IPermit;
    merkleTreeHeight?: number;
    fromBlock?: bigint;
    toBlock?: bigint;
    safeModule?: ISafeModule;
}
export interface ITransactResult {
    receipt: TransactionReceipt;
    viewingKey: HexString;
}
export interface IFindUtxosInputs {
    pool?: any;
    keypair: KeyPair | SnapKeyPair;
    tokens: EthAddress[];
    excludeSpent?: boolean;
    excludeOthers?: boolean;
    from?: bigint;
}
export interface IFindFlaggedUtxos {
    pool?: any;
    keypair: KeyPair | SnapKeyPair;
    token: EthAddress;
    excludeSpent?: boolean;
    excludeOthers?: boolean;
    from?: bigint;
    excludeUtxos?: Utxo[];
}
export interface IFindFlaggedUtxosResult {
    utxos: Utxo[];
}
export interface IFindUtxosUpToInputs {
    pool?: any;
    keypair: KeyPair | SnapKeyPair;
    token: EthAddress;
    excludeSpent?: boolean;
    excludeOthers?: boolean;
    from?: bigint;
    amount: bigint;
    results?: number;
    excludeUtxos?: Utxo[];
    targetCompliant?: boolean;
}
export interface IFindUtxosUpToOutputs {
    utxos: Utxo[];
    uncompliantDepositIds?: bigint[];
    uncompliantAmounts?: bigint[];
    compliantDepositIds?: bigint[];
    compliantAmounts?: bigint[];
}
export interface IFindUtxosResult {
    [key: EthAddress]: Utxo[];
}
export interface ISnapParams {
    snapId?: string;
    method: string;
    params?: Record<string, unknown>;
}
export interface IStorageInputs {
    namespace: string;
    key: string;
    prefix?: string;
}
export interface IUtxoCacheItem {
    block: bigint;
    utxos: IFindUtxosResult;
}
export interface ICommitmentEvent {
    commitment: string;
    index: bigint;
    encryptedOutput: string;
}
export interface ICommitmentEventCacheItem {
    block: bigint;
    events: ICommitmentEvent[];
}
export interface IStorageProvider {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
}
export interface IStorageGetInputs<T> extends IStorageInputs {
    deserializer?: (text: string) => T;
}
export interface IStorageSetInputs<T> extends IStorageInputs {
    value: T;
    serializer?: (value: T) => string;
}
export interface IStorageDelInputs<T> extends IStorageInputs {
}
export interface IRelayRequest {
    chainId: number | bigint;
    to: EthAddress;
    data: HexString;
    [key: string]: any;
}
export interface IPermitPayload {
    owner: Signer;
    spender: EthAddress;
    amount: bigint;
    token: EthAddress;
    deadline?: number;
}
export interface ISnapFundPrepareInputs {
    amount: bigint;
    token: EthAddress;
    from: EthAddress;
    to: HexString;
    note: string;
    fee: bigint;
}
export interface ISnapFundDispatchInputs {
    args: IArgs;
    extData: IExtData;
    funderSig: HexString;
    feeToken: EthAddress;
    gasLimit: bigint;
}
export interface ISnapTransferPrepareInputs {
    amount: bigint;
    token: EthAddress;
    to: HexString;
    note: string;
    keypair: KeyPair;
    fee: bigint;
}
export interface ISnapTransferDispatchInputs {
    args: IArgs;
    extData: IExtData;
    feeToken: EthAddress;
    gasLimit: bigint;
}
export interface ISnapWithdrawPrepareInputs {
    amount: bigint;
    token: EthAddress;
    to: EthAddress;
    keypair: KeyPair;
    fee: bigint;
    unwrap: boolean;
}
export interface ISnapWithdrawDispatchInputs extends ISnapTransferDispatchInputs {
}
export interface ISnapSwapPrepareInputs {
    sellAmount: bigint;
    sellToken: EthAddress;
    buyToken: EthAddress;
    buyAmount: bigint;
    keypair: KeyPair;
    swapper: HexString;
    note: string;
}
export interface ISnapSwapPrepareResult {
    argsW: IArgs;
    extDataW: IExtData;
    amountIn: bigint;
    minAmountOut: bigint;
    argsF: IArgs;
    extDataF: IExtData;
}
export interface ISnapSwapDispatchInputs extends ISnapSwapPrepareResult {
}
export interface IQuoteExactInputSingle {
    sellAmount: bigint;
    sellToken: EthAddress;
    buyToken: EthAddress;
}
export interface IQuoteExactOutputSingle {
    buyAmount: bigint;
    sellToken: EthAddress;
    buyToken: EthAddress;
}
export interface IRegistryRecord {
    nativeAddress: EthAddress;
    shieldedAddress: HexString;
    name: string | HexString;
    expiry: bigint;
}
export interface IRegistryModule {
    ethereumAddressOf(shieldedAddressOrAlias: HexString | `${string}.bay`): Promise<undefined | EthAddress>;
}
export interface ITransferDetails {
    from: HexString;
    to: HexString;
    value: bigint;
}
export interface IConfig {
    chainId: bigint;
    merkleTreeHeight: number;
    startBlock: bigint;
    provider: Provider;
    registry: Contract;
    pool: Contract;
    keyringSnap?: string;
    mptProver?: string;
    signMsgHashLib?: EthAddress;
    relayer?: string;
    complianceManager?: string;
    USDC?: EthAddress;
    WETH?: EthAddress;
    sUSDC?: EthAddress;
    proposeTxLib?: EthAddress;
    multiCall?: EthAddress;
    multiSend?: EthAddress;
    multiSendCallOnly?: EthAddress;
    erc6538Registry?: EthAddress;
    erc5564Announcer?: EthAddress;
    compliance?: EthAddress;
    predicateRegistry?: EthAddress;
    proverThreads?: number;
    storagePrefix?: string;
    utxoCache?: string;
    commitmentEventsCache?: string;
    [key: string]: any;
}
export declare enum UtxoType {
    Bogus = 0,
    Fund = 1,
    Transfer = 2,
    Withdrawal = 3,
    Bucket = 4,
    Remainder = 5
}
export interface IStxHashParams {
    root: bigint;
    publicAmount: bigint;
    extDataHash: bigint;
    recipient: EthAddress;
    spendingLimit: bigint;
    inputNullifiers: bigint[];
    outputCommitments: bigint[];
}
export interface ISafeChallengeHashParams {
    stxHash: HexString;
    safe: EthAddress;
}
export interface ISafeZkStorageProof {
    proof: HexString;
    publicInputs: HexString[];
    challenge: HexString;
    blockNumber: bigint;
    blockHash: HexString;
}
export declare enum OperationType {
    Call = 0,
    DelegateCall = 1
}
export declare enum SafeTxConfirmationStatus {
    Pending = 0,
    AlmostReady = 1,
    Ready = 2
}
export interface MetaTransactionData {
    to: string;
    value: string;
    data: string;
    operation?: OperationType;
}
export interface ISafeTx extends MetaTransactionData {
    operation: OperationType;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
}
export interface ISafeTxInfo {
    hash: Hex32;
    details: ISafeTx;
    confirmationStatus: SafeTxConfirmationStatus;
    signatures: {
        [key: EthAddress]: HexString;
    };
    executed: boolean;
    txHash?: Hex32;
}
export interface TypedDataDomain {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: ArrayLike<number> | string;
}
export interface TypedDataTypes {
    name: string;
    type: string;
}
export type TypedMessageTypes = {
    [key: string]: TypedDataTypes[];
};
export interface EIP712TypedData {
    domain: TypedDataDomain;
    types: TypedMessageTypes;
    message: Record<string, unknown>;
    primaryType?: string;
}
export interface SafeEIP712Args {
    safeAddress: string;
    safeVersion: string;
    chainId: bigint;
    data: ISafeTx | EIP712TypedData | string;
}
export interface EIP712TypedDataMessage {
    types: EIP712MessageTypes;
    domain: {
        chainId?: number;
        verifyingContract: string;
    };
    primaryType: 'SafeMessage';
    message: {
        message: string;
    };
}
export interface EIP712MessageTypes {
    EIP712Domain: {
        type: string;
        name: string;
    }[];
    SafeMessage: [
        {
            type: 'bytes';
            name: 'message';
        }
    ];
}
export interface EIP712TxTypes {
    EIP712Domain: {
        type: string;
        name: string;
    }[];
    SafeTx: {
        type: string;
        name: string;
    }[];
}
export interface EIP712MessageTypes {
    EIP712Domain: {
        type: string;
        name: string;
    }[];
    SafeMessage: [
        {
            type: 'bytes';
            name: 'message';
        }
    ];
}
export type EIP712Types = EIP712TxTypes | EIP712MessageTypes;
export interface EIP712TypedDataTx {
    types: EIP712TxTypes;
    domain: {
        chainId?: string;
        verifyingContract: string;
    };
    primaryType: 'SafeTx';
    message: {
        to: string;
        value: string;
        data: string;
        operation: OperationType;
        safeTxGas: string;
        baseGas: string;
        gasPrice: string;
        gasToken: string;
        refundReceiver: string;
        nonce: number;
    };
}
export interface ISafeModule {
    utils: {
        isOwner(safeContract: Contract, signer?: EthAddress): Promise<boolean>;
        getSafeTxHash(safeContract: Contract, safeTx: ISafeTx): any;
        signSafeTx(signer: Signer, safeAddress: string, safeTx: ISafeTx, chainId: bigint): Promise<HexString>;
        recoverSigner(safeTxHash: Hex32, sig: HexString): EthAddress;
        buildSignatureBytes(signatures: {
            data: HexString;
            signer: EthAddress;
        }[]): string;
        encodeMultiSendData(txs: Partial<ISafeTx>[]): string;
    };
    mpecdh: IMpecdhModule;
    shieldedToSafe(shieldedAddress: HexString): Promise<EthAddress | null>;
    challengeHash(params: ISafeChallengeHashParams): HexString;
    fetchZkStorageProof(safeAddress: EthAddress, messageHash: HexString): Promise<ISafeZkStorageProof>;
    listTxs(safe: EthAddress, owner?: EthAddress): Promise<{
        all: ISafeTxInfo[];
        pending: ISafeTxInfo[];
        unconfirmed?: ISafeTxInfo[];
    }>;
    proposePayload(safe: EthAddress, safeTx: ISafeTx, owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    proposeBatchPayload(safe: EthAddress, safeTxs: Partial<ISafeTx>[], owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    confirmPayload(safe: EthAddress, safeTxHash: Hex32, owner: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    executePayload(safe: EthAddress, safeTxHash: Hex32, owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
}
export interface IStorageModule {
    set<T>(inputs: IStorageSetInputs<T>): boolean;
    get<T>(inputs: IStorageGetInputs<T>): null | T;
    del<T>(inputs: IStorageDelInputs<T>): boolean;
}
export interface IMessageCiphertextPayload {
    /** 24-byte XChaCha20 nonce used during encryption */
    nonce: Uint8Array;
    /** XChaCha20 encryption of the given plaintext */
    ciphertext: Uint8Array;
    /** Concatenation of nonce and ciphertext */
    payload: Uint8Array;
}
export interface IPublishSafeCiphertextParams {
    chainId?: bigint | number;
    signMessageHashLibAddress: EthAddress;
    safeAddress: EthAddress;
    secretKey: Uint8Array;
    preimage: Uint8Array;
    relayer?: string;
    /** Defaults to true; set to false to only compute payload/calldata */
    viaRelayer?: boolean;
}
export interface ISafeMessageCiphertextPublication extends IMessageCiphertextPayload {
    topic: Hex32;
    calldata: HexString;
    txHash?: Hex32;
}
export interface ICalcTokenAmount {
    /** Slippage expressed as a percentage in the range from 0 to 1. */
    slippage: number;
    /** The gas required to execute the transaction. */
    executionFee: bigint;
    /** Token value in ETH. */
    tokenEthValue: bigint;
}
export interface ICalcExecutionFee {
    /** Fee value in ETH. */
    feeEthValue: bigint;
    /** The gas required to execute the transaction. */
    executionCost: bigint;
}
export interface IGetTokenEthValue {
    /** Token address. */
    token: EthAddress;
    /** Token decimals. */
    decimals: number;
    /** Token mount. */
    amount: bigint;
}
export interface ICalcExecutionCost {
    /** Transaction recipient. */
    to: EthAddress;
    /** Transaction data. */
    data: HexString;
    /** Provider used to interact with the chain. */
    provider: Provider;
    /** Value used in the transaction. */
    value?: bigint;
}
export interface ICalcFeeEthValue {
    /** Fee expressed as a percentage in the range from 0 to 1. */
    fee: number;
    /** The gas required to execute the transaction. */
    executionCost: bigint;
}
export type AnySigner = EthersSigner | ViemAccount | ViemWalletClient;
export interface IStealthParams {
    /** Bermuda Key Pair used for e.g. proof generation. */
    spender: KeyPair;
    /** Stealth signer identifier/nonce to derive the stealth privkey =keccak256(shspendkey,stnonce) */
    id?: number | bigint;
    unshield?: {
        /** Token to be used in the action. */
        token: EthAddress;
        /** Amount token amount to be used in the action. */
        amount: bigint;
    };
    /** Permit options that will be used to create a permit payload. */
    permit?: IStealthPermit;
    reshield?: {
        /** Recipient shielded address. */
        to: `${string}.bay` | HexString;
        /** Token to be used in the action. */
        token: EthAddress;
        /** Amount token amount to be used in the action. */
        amount: bigint;
    };
}
export interface IStealthSetupParams {
    shieldedKeyPair: KeyPair | SnapKeyPair;
    id: number | bigint;
    gasTank?: bigint;
    relayerFee?: bigint;
    relayer?: EthAddress;
}
export interface IStealthPermit {
    /** The token contract address. */
    token: EthAddress;
    /** The amount to permit. */
    amount: bigint;
    /** The address that can spend the funds. */
    spender: EthAddress;
    /** Deadline until which the permit signature remains valid. */
    deadline: number;
}
export type StealthAction = (stealthSigner: Signer) => IStealthActionPayload | IStealthActionPayload[] | Promise<IStealthActionPayload | IStealthActionPayload[]>;
export interface IGenerateStealtAddressOptions {
    chainId?: number | bigint;
    ephemeralPrivateKey?: HexString;
}
export interface IStealthAddressArtifacts {
    /** The generated stealth address. */
    stealthAddress: EthAddress;
    /** The ephemeral public key used to generate the stealth address. */
    ephemeralPublicKey: HexString;
    /** The view tag derived from the hashed shared secret. */
    viewTag: HexString;
    /** The above props packed as ERC5564Announcer payload. */
    announcement: IPayload;
}
export interface IComputeStealthKeyOptions {
    /** Shielded key pair to derive the stealth meta address from. */
    shieldedKeyPair: KeyPair | SnapKeyPair;
    /** The viewing private key. */
    viewingPrivateKey?: HexString;
    /** The spending private key. */
    spendingPrivateKey?: HexString;
    /** The ephemeral public key from the announcement. */
    ephemeralPublicKey?: HexString;
}
export interface IStealthMetaKeys {
    spendingPublicKey: HexString;
    spendingPrivateKey: HexString;
    viewingPublicKey: HexString;
    viewingPrivateKey: HexString;
}
export interface IDepositParams {
    signer: AnySigner;
    token: EthAddress;
    recipients: {
        amount: bigint;
        to: `${string}.bay` | HexString;
    }[];
}
export interface IDepositOptions {
    relayer?: HexString | EthAddress;
    fee?: bigint;
    topup?: boolean;
    depositId?: bigint;
    userKeyPair?: KeyPair | SnapKeyPair;
    permitSeconds?: number | bigint;
}
export interface ITransferParams {
    spender: KeyPair | SnapKeyPair;
    token: EthAddress;
    recipients: {
        amount: bigint;
        to: `${string}.bay` | HexString;
    }[];
}
export interface ITransferOptions {
    snap?: boolean;
    relayer?: HexString;
    fee?: bigint;
}
export interface ITransferPlanStep {
    /** Per-recipient transfer amounts for one chunk step, preserving recipient order. */
    amounts: bigint[];
    /** Sum of `amounts`. */
    total: bigint;
    /** Planned input UTXOs for this step. */
    inputs?: Utxo[];
    /** Planned output UTXOs for this step. */
    outputs?: Utxo[];
}
export interface ITransferPlan {
    token: EthAddress;
    recipients: {
        amount: bigint;
        to: `${string}.bay` | HexString;
    }[];
    /** Chunk steps to execute in order. */
    steps: ITransferPlanStep[];
    /** Sum of all recipient requested amounts. */
    total: bigint;
}
export interface IWithdrawParams {
    spender: KeyPair | SnapKeyPair;
    token: EthAddress;
    amount: bigint;
    to: EthAddress | `${string}.eth` | `${string}.gno`;
    isPublic?: boolean;
}
export interface IWithdrawOptions {
    snap?: boolean;
    unwrap?: boolean;
    relayer?: EthAddress;
    fee?: bigint;
}
export interface IWithdrawPlanStep {
    /** Withdraw amount for this step. */
    amount: bigint;
    /** Planned input UTXOs for this step. */
    inputs?: Utxo[];
    /** Planned output UTXOs for this step. */
    outputs?: Utxo[];
}
export interface IWithdrawPlan {
    token: EthAddress;
    to: EthAddress;
    /** Chunk steps to execute in order. */
    steps: IWithdrawPlanStep[];
    /** Sum of all requested amounts. */
    total: bigint;
}
export interface IComplianceManagerRequest {
    to: string;
    from: string;
    data: string;
    msgValue: string;
    amount: string;
    chain: string;
    token: string;
    commitmentHash: string;
    signature: string;
    depositId: string;
}
export interface IComplianceManagerSignResponse {
    complianceManagerSignature: string;
    complianceManagerPublickeyPoints: {
        pubkeyX: string;
        pubkeyY: string;
    };
}
export interface IComplianceManagerBlackList {
    blacklist: string[];
}
export interface IComplianceManagerPubKey {
    pubkeyX: bigint;
    pubkeyY: bigint;
}
export interface IComplianceManagerCheckResponse {
    attestationResponse: IAttestationResponse;
}
export interface IAttestationResponse {
    policy_id: string;
    is_compliant: boolean;
    attestation: {
        uuid: string;
        expiration: number;
        attester: string;
        signature: string;
    };
}
/**
 * A x402 Bermuda sub scheme:
 * - "bermuda::deposit": Support deposit payments
 *   -> public payer+amount, payee total balance private
 * - "bermuda::transfer": Support transfer payments
 *   -> private payer, payee total balance private
 * - "bermuda::anyhow": Default to the transfer scheme,
 *   fallback to the deposit scheme if insufficient Bermuda balance
 */
export declare enum x402Scheme {
    BermudaDeposit = "bermuda::deposit",
    BermudaTransfer = "bermuda::transfer",
    BermudaAnyhow = "bermuda::anyhow"
}
/**
 * Facilitator extension "facilitator-fee" that allows paying the facilitator.
 * If advertised by resource servers, x402 Bermuda clients will generate the
 * payload incl. Bermuda ZK proofs with a dedicated fee for the facilitator.
 */
export interface x402FacilitatorFeeExtension {
    payee: string;
    amount: bigint;
}
export interface IProposeMpecdhDeployment {
    safeTxHash: HexString;
    safeAddress: EthAddress;
    mpecdhAddress: EthAddress;
}
export interface IPayload {
    chainId: number;
    to: EthAddress;
    data: HexString;
}
export interface IMpecdh {
    contract: Contract;
    blocking(): Promise<EthAddress[]>;
    status(signer: Signer): Promise<Number>;
    step0(signer: Signer): Promise<ContractTransactionResponse>;
    stepN(signer: Signer): Promise<ContractTransactionResponse>;
    stepX(signer: Signer): Promise<HexString>;
}
export interface IMpecdhModule {
    isDeployed(safeAddress: EthAddress): Promise<EthAddress | null>;
    isReady(safeAddress: EthAddress): Promise<boolean>;
    calcAddress(safeAddress: EthAddress, owners: EthAddress[]): Promise<EthAddress>;
    proposeDeployment(signer: any, safeAddress: EthAddress, provider: any): Promise<IProposeMpecdhDeployment>;
    proposeDeploymentViaApproveHash(signer: any, safeAddress: EthAddress, provider: any): Promise<IProposeMpecdhDeployment>;
    initKeyExchange(mpecdhAddress: EthAddress): Promise<IMpecdh>;
}
export interface IMulticallPayload extends Omit<IPayload, 'chainId'> {
    /** The value that's used when the contract is payable. */
    value: bigint;
}
export interface IStealthActionPayload extends Omit<IPayload, 'chainId'> {
    /** The value that's used when the contract is payable. */
    value?: bigint;
}
export interface ISdk {
    deposit(params: IDepositParams, options?: IDepositOptions): Promise<IPayload>;
    transfer(params: ITransferParams, options?: ITransferOptions): Promise<IPayload>;
    previewTransferPlan(params: ITransferParams, options?: ITransferOptions): Promise<ITransferPlan>;
    executeTransferPlan(params: ITransferParams, plan: ITransferPlan): Promise<Hex32[]>;
    withdraw({ spender, token, amount, to }: IWithdrawParams, options?: IWithdrawOptions): Promise<IPayload>;
    publicWithdraw({ token, amount, spender, to }: IWithdrawParams, options?: IWithdrawOptions): Promise<IPayload>;
    previewWithdrawPlan(params: IWithdrawParams, options?: IWithdrawOptions): Promise<IWithdrawPlan>;
    executeWithdrawPlan(params: IWithdrawParams, plan: IWithdrawPlan, options?: IWithdrawOptions): Promise<Hex32[]>;
    executePublicWithdrawPlan(params: IWithdrawParams, plan: IWithdrawPlan, options?: IWithdrawOptions): Promise<Hex32[]>;
    stealthSetup(params: IStealthSetupParams): Promise<IPayload | {
        authorizationList: HexString[];
    }>;
    stealth(params: IStealthParams, action: StealthAction): Promise<{
        payload: IPayload;
        signer: Wallet;
    }>;
    x402Fetch(scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow', signer?: ClientEvmSigner | WalletClient, spender?: KeyPair, fetch?: Fetch): Fetch;
    buildMerkleTree(pool?: Contract): Promise<MerkleTree>;
    getTransactProof({ inputs, outputs, tree, extAmount, fee, recipient, funder }: ITransactProofPreimage): Promise<IArgs>;
    prepareTransact({ pool, inputs, outputs, fee, recipient, relayer, funder, unwrap, token }: ITransactInputs): Promise<ITransactArtifacts>;
    transact({ pool, ...rest }: ITransactInputs): Promise<ITransactResult>;
    safeChallengeHash(params: ISafeChallengeHashParams): HexString;
    safeZkStorageProof(safeAddress: EthAddress, messageHash: HexString): Promise<ISafeZkStorageProof>;
    safeListTxs(safe: EthAddress, owner?: EthAddress): Promise<{
        all: ISafeTxInfo[];
        pending: ISafeTxInfo[];
        unconfirmed?: ISafeTxInfo[];
    }>;
    shieldedToSafe(shieldedAddress: HexString): Promise<EthAddress | null>;
    safeProposeTx(safe: EthAddress, safeTx: ISafeTx, owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    safeProposeBatchTx(safe: EthAddress, safeTxs: Partial<ISafeTx>[], owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    safeConfirmTx(safe: EthAddress, safeTxHash: Hex32, owner: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    safeExecuteTx(safe: EthAddress, safeTxHash: Hex32, owner?: Signer): Promise<{
        to: EthAddress;
        data: HexString;
    }>;
    safeIsOwner(safeContract: Contract, signer?: EthAddress): Promise<boolean>;
    safeGetTxHash(safeContract: Contract, safeTx: ISafeTx): any;
    safeSignTx(signer: Signer, safeAddress: string, safeTx: ISafeTx, chainId: bigint): Promise<HexString>;
    safeRecoverSigner(safeTxHash: Hex32, sig: HexString): EthAddress;
    safeBuildSignatureBytes(signatures: {
        data: HexString;
        signer: EthAddress;
    }[]): string;
    mpecdhIsDeployed(safeAddress: EthAddress): Promise<EthAddress | null>;
    mpecdhIsReady(safeAddress: EthAddress): Promise<boolean>;
    mpecdhCalcAddress(safeAddress: EthAddress, owners: EthAddress[]): Promise<EthAddress>;
    mpecdhProposeDeployment(signer: any, safeAddress: EthAddress, provider: any): Promise<IProposeMpecdhDeployment>;
    mpecdhProposeDeploymentViaApproveHash(signer: any, safeAddress: EthAddress, provider: any): Promise<IProposeMpecdhDeployment>;
    mpecdhInitKeyExchange(mpecdhAddress: EthAddress): Promise<IMpecdh>;
    registryList(): Promise<IRegistryRecord[]>;
    isRegistered(shieldedAddress: HexString): Promise<boolean>;
    bermudaAddressOf(addressOrAlias: EthAddress | `${string}.bay`): Promise<HexString>;
    ethereumAddressOf(shieldedAddressOrAlias: HexString | `${string}.bay`): Promise<undefined | EthAddress>;
    aliasOf(address: HexString | EthAddress): Promise<string>;
    register(signer: Signer, shieldedAddress: HexString, name: string | undefined, safeAddress: EthAddress): Promise<TransactionReceipt>;
    resolveShieldedAddress(x: any): Promise<undefined | HexString>;
    resolveNativeAddress(x: any): Promise<undefined | EthAddress>;
    lookupEnsName(nativeAddress: EthAddress): Promise<undefined | string>;
    lookupGnoName(nativeAddress: EthAddress): Promise<undefined | string>;
    ERC20_ABI: any[];
    WETH_ABI: any[];
    ERC4626_ABI: any[];
    POOL_ABI: any[];
    REGISTRY_ABI: any[];
    SAFE_ABI: any[];
    MULTICALL_ABI: any[];
    PROPOSE_TX_LIB_ABI: any[];
    SIGN_MESSAGE_HASH_LIB_ABI: any[];
    findUtxos: ({ pool, keypair, tokens, excludeSpent, excludeOthers, from }: IFindUtxosInputs) => Promise<IFindUtxosResult>;
    findUtxosUpTo: ({ pool, keypair, excludeSpent, excludeOthers, from, token, amount }: IFindUtxosUpToInputs) => Promise<IFindUtxosUpToOutputs>;
    relay: (relayEndpoint: string, { chainId, to, data }: IRelayRequest) => Promise<Hex32>;
    sumAmounts: (utxos?: Utxo[]) => bigint;
    mapTransactArgs: ([_args, _extData]: [any, IExtData]) => [any[], any[]];
    hex: (b: any, byteLength?: number) => string;
    bigint2bytes: (b: bigint, out?: Uint8Array) => Uint8Array;
    onprogress: (handler: ProgressHandler) => () => void;
    permit({ signer, token, amount, spender, deadline }: {
        signer: AnySigner;
        token: EthAddress;
        amount: bigint;
        spender: EthAddress;
        deadline: bigint;
    }): Promise<IDepositPermit>;
    progress: (desc: string) => void;
    encryptMessageCiphertext: (secretKey: Uint8Array, plaintext: Uint8Array) => IMessageCiphertextPayload;
    decryptMessageCiphertext: (secretKey: Uint8Array, payload: Uint8Array) => Uint8Array;
    splitMessageCiphertextPayload: (payload: Uint8Array) => {
        nonce: Uint8Array;
        ciphertext: Uint8Array;
    };
    calcMessageCiphertextTopic: (params: {
        chainId: bigint | number;
        safeAddress: EthAddress;
        secretKey: Uint8Array;
    }) => Hex32;
    publishSafeMessageCiphertext: (params: IPublishSafeCiphertextParams) => Promise<ISafeMessageCiphertextPublication>;
    encodeStx(stx: IStxHashParams): string;
    decodeStx(encodedStx: string): IStxHashParams;
    poseidon2(...items: bigint[]): bigint;
    verifyExclusionProofs(keys: bigint[], proofs: IIndexedMerkleProofs, expectedRoot: bigint): any;
    SAFE_MSG_CIPHERTEXT_NONCE_LENGTH: number;
    BN254_FIELD_SIZE: bigint;
    PERMIT_TYPES: {
        Permit: {
            name: string;
            type: string;
        }[];
    };
    KeyPair: typeof KeyPair;
    Utxo: typeof Utxo;
    IndexedMerkleTree: typeof IndexedMerkleTree;
    OperationType: typeof OperationType;
    config: IConfig;
    _: any;
}
