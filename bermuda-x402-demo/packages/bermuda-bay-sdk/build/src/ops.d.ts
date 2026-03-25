import { IConfig, IDepositParams, ITransferParams, IWithdrawParams, IPayload, IDepositOptions, ITransferOptions, ITransferPlan, IWithdrawOptions, IWithdrawPlan, Hex32 } from './types.js';
export default function init(config: IConfig): {
    /**
     * Assembles a deposit payload.
     * Multiple deposit recipients can be declared in a single shielded tx.
     *
     * @param signer Any signer
     * @param params.token Token address
     * @param params.recipients[].amount Amount to deposit
     * @param params.recipients[].to Deposit recipient's shielded address
     * @param options.relayer Relayer's native address
     * @param options.fee Relayer fee
     * @param options.permitSeconds Seconds the conditional permit is valid for
     * @returns Transaction payload
     */
    deposit(params: IDepositParams, options?: IDepositOptions): Promise<IPayload>;
    /**
     * Assembles a single shielded transfer payload.
     * For chunked execution, use previewTransferPlan + executeTransferPlan.
     *
     * @param params.spender The sender's shielded key pair
     * @param params.token Token address
     * @param params.recipients[].amount Amount to transfer
     * @param params.recipients[].to Deposit recipient's shielded address
     * @param options.relayer Relayer shielded address
     * @param options.fee Relayer fee
     * @returns Transaction payload
     */
    transfer(params: ITransferParams, options?: ITransferOptions): Promise<IPayload>;
    /**
     * Builds a chunk execution plan for transfer.
     * The plan fixes recipient amount splits per chunk, but does not include proofs.
     *
     * @param params Transfer parameters
     * @param options Transfer options
     * @returns Chunk plan
     */
    previewTransferPlan(params: ITransferParams, options?: ITransferOptions): Promise<ITransferPlan>;
    /**
     * Executes a precomputed transfer plan.
     * Each step rebuilds proof and payload against latest chain state.
     *
     * @param params Transfer parameters
     * @param plan Precomputed transfer plan
     * @param options Transfer options
     * @returns Relayed transaction hashes
     */
    executeTransferPlan(params: ITransferParams, plan: ITransferPlan): Promise<Hex32[]>;
    /**
     * Builds a chunk execution plan for withdraw.
     * The plan fixes inputs/outputs per step, but does not include proofs.
     *
     * @param params Withdraw parameters
     * @param options Withdraw options
     * @returns Chunk plan
     */
    previewWithdrawPlan(params: IWithdrawParams, _options?: IWithdrawOptions): Promise<IWithdrawPlan>;
    /**
     * Executes a precomputed withdraw plan.
     * Each step rebuilds proof and payload against latest chain state.
     *
     * @param params Withdraw parameters
     * @param plan Precomputed withdraw plan
     * @param options Withdraw options
     * @returns Relayed transaction hashes
     */
    executeWithdrawPlan(params: IWithdrawParams, plan: IWithdrawPlan, options?: IWithdrawOptions): Promise<Hex32[]>;
    /**
     * Executes a precomputed public withdraw plan.
     * Each step rebuilds proof and payload against latest chain state.
     *
     * @param params Public withdraw parameters
     * @param plan Precomputed public withdraw plan
     * @param options Public Withdraw options
     * @returns Relayed transaction hashes
     */
    executePublicWithdrawPlan(params: IWithdrawParams, plan: IWithdrawPlan, options?: IWithdrawOptions): Promise<Hex32[]>;
    /**
     * Assembles a withdrawal payload.
     *
     * @param params.spender The sender's shielded key pair
     * @param params.token Token address
     * @param params.amount Amount to withdraw
     * @param params.to Recipient's native address
     * @param options.relayer Relayer's native address
     * @param options.fee Relayer fee
     * @param options.unwrap Unwrap WETH?
     * @returns Transaction payload
     */
    withdraw(params: IWithdrawParams, options?: IWithdrawOptions): Promise<IPayload>;
    /**
     * Assembles a public withdrawal payload.
     *
     * @param params.senderKeyPair The sender's shielded key pair
     * @param params.token Token address
     * @param params.amount Amount to withdraw
     * @param params.recipient Recipient's native address
     * @param options.relayer Relayer's native address
     * @param options.fee Relayer fee
     * @param options.unwrap Unwrap WETH?
     * @returns Transaction payload
     */
    publicWithdraw(params: IWithdrawParams, options?: IWithdrawOptions): Promise<IPayload>;
};
