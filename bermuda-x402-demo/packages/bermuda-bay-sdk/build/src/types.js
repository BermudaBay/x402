export var UtxoType;
(function (UtxoType) {
    UtxoType[UtxoType["Bogus"] = 0] = "Bogus";
    UtxoType[UtxoType["Fund"] = 1] = "Fund";
    UtxoType[UtxoType["Transfer"] = 2] = "Transfer";
    UtxoType[UtxoType["Withdrawal"] = 3] = "Withdrawal";
    UtxoType[UtxoType["Bucket"] = 4] = "Bucket";
    UtxoType[UtxoType["Remainder"] = 5] = "Remainder";
})(UtxoType || (UtxoType = {}));
export var OperationType;
(function (OperationType) {
    OperationType[OperationType["Call"] = 0] = "Call";
    OperationType[OperationType["DelegateCall"] = 1] = "DelegateCall";
})(OperationType || (OperationType = {}));
export var SafeTxConfirmationStatus;
(function (SafeTxConfirmationStatus) {
    SafeTxConfirmationStatus[SafeTxConfirmationStatus["Pending"] = 0] = "Pending";
    SafeTxConfirmationStatus[SafeTxConfirmationStatus["AlmostReady"] = 1] = "AlmostReady";
    SafeTxConfirmationStatus[SafeTxConfirmationStatus["Ready"] = 2] = "Ready";
})(SafeTxConfirmationStatus || (SafeTxConfirmationStatus = {}));
// ============================================================================
// x402
// ============================================================================
/**
 * A x402 Bermuda sub scheme:
 * - "bermuda::deposit": Support deposit payments
 *   -> public payer+amount, payee total balance private
 * - "bermuda::transfer": Support transfer payments
 *   -> private payer, payee total balance private
 * - "bermuda::anyhow": Default to the transfer scheme,
 *   fallback to the deposit scheme if insufficient Bermuda balance
 */
export var x402Scheme;
(function (x402Scheme) {
    x402Scheme["BermudaDeposit"] = "bermuda::deposit";
    x402Scheme["BermudaTransfer"] = "bermuda::transfer";
    x402Scheme["BermudaAnyhow"] = "bermuda::anyhow";
})(x402Scheme || (x402Scheme = {}));
//# sourceMappingURL=types.js.map