import { PaymentRequirements, SchemeNetworkClient, PaymentPayloadResult, PaymentPayloadContext, AssetAmount, Network, Price, SchemeNetworkServer, MoneyParser } from '@x402/core/types';
import { type ClientEvmSigner } from '@x402/evm';
import KeyPair from './keypair';
import { x402Scheme, Fetch } from './types';
import { WalletClient } from 'viem';
/**
 * EVM client implementation for the Bermuda private payment scheme.
 *
 * The scheme has three variants:
 *   - "bermuda::deposit": Support deposit payments
 *     -> public payer+amount, payee total balance private
 *   - "bermuda::transfer": Support transfer payments
 *     -> private payer, payee total balance private
 *   - "bermuda::anyhow": Default to the transfer scheme,
 *     fallback to the deposit scheme if insufficient Bermuda balance
 * For the deposit scheme, currently only EIP-2612 permit signatures are
 * supported.
 *
 * @dev A prominent non-EIP-2612-compatible token is USDT on mainnet.
 * To use it as a payment token, bots either have to provide sufficient
 * allowance to the Bermuda pool contract through approve transactions or
 * we will need to implement workarounds in the code here itself.
 */
export declare class x402BermudaClientScheme implements SchemeNetworkClient {
    readonly scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow';
    private readonly signer?;
    private readonly spender?;
    static readonly SUPPORTED_NETWORKS: Set<number>;
    permitSeconds: number | bigint;
    /**
     * Creates a new Bermuda EVM client instance.
     *
     * @param signer - The EVM signer for client operations.
     *   For EVM signers:
     *     Must support `readContract` for EIP-2612 gas sponsoring.
     *     Use `createWalletClient(...).extend(publicActions)` or `toClientEvmSigner(account, publicClient)`.
     * @param spender - The Bermuda spender key pair for the transfer scheme
     * @param scheme - A valid Bermuda sub scheme:
     *   - "bermuda::deposit": Support deposit payments
     *     -> public payer+amount, payee total balance private
     *   - "bermuda::transfer": Support transfer payments
     *     -> private payer, payee total balance private
     *   - "bermuda::anyhow": Default to the transfer scheme,
     *     fallback to the deposit scheme if insufficient Bermuda balance
     */
    constructor(scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow', signer?: (ClientEvmSigner | WalletClient) | undefined, spender?: KeyPair | undefined);
    /**
     * Sets the permit validity in seconds; default is 100.
     * @param permitSeconds Validity period of EIP-2612 permits in seconds.
     */
    setPermitSeconds(permitSeconds: number | bigint): void;
    /**
     * Creates a payment payload for the Bermuda scheme.
     * For the deposit scheme, currently only EIP-2612 permit signatures are supported.
     *
     * The facilitator may charge a fee to cover to gas costs of the settle. If
     * `context.extensions["facilitator-fee"].amount` and
     * `context.extensions["facilitator-fee"].payee` are set this denotes the
     * relay fee and facilitator's address respectively and should be
     * passed to the Bermuda SDK accordingly. In case of deposits the advertised
     * address should be the facilitator's Ethereum address, in case of transfers
     * it should be the facilitator's Bermuda address.
     *
     * @param x402Version - The x402 protocol version
     * @param paymentRequirements - The payment requirements
     * @param context - Optional context with server-declared extensions
     *
     * @returns Promise resolving to a payment payload result (with optional extensions)
     */
    createPaymentPayload(x402Version: number, paymentRequirements: PaymentRequirements, context?: PaymentPayloadContext): Promise<PaymentPayloadResult>;
}
/**
 * EVM server implementation for the Bermuda payment scheme.
 */
export declare class x402BermudaServerScheme implements SchemeNetworkServer {
    readonly scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow';
    private moneyParsers;
    /**
     * Creates a new Bermuda EVM server instance.
     *
     * @param scheme - A valid Bermuda sub scheme:
     *   - "bermuda::deposit": Support deposit payments
     *     -> public payer+amount, payee total balance private
     *   - "bermuda::transfer": Support transfer payments
     *     -> private payer, payee total balance private
     *   - "bermuda::anyhow": Default to the transfer scheme,
     *     fallback to the deposit scheme if insufficient Bermuda balance
     */
    constructor(scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow');
    /**
     * Register a custom money parser in the parser chain.
     * Multiple parsers can be registered - they will be tried in registration order.
     * Each parser receives a decimal amount (e.g., 1.50 for $1.50).
     * If a parser returns null, the next parser in the chain will be tried.
     * The default parser is always the final fallback.
     *
     * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
     * @returns The server instance for chaining
     *
     * @example
     * evmServer.registerMoneyParser(async (amount, network) => {
     *   // Custom conversion logic
     *   if (amount > 100) {
     *     // Use different token for large amounts
     *     return { amount: (amount * 1e18).toString(), asset: "0xCustomToken" };
     *   }
     *   return null; // Use next parser
     * });
     */
    registerMoneyParser(parser: MoneyParser): x402BermudaServerScheme;
    /**
     * Parses a price into an asset amount.
     * If price is already an AssetAmount, returns it directly.
     * If price is Money (string | number), parses to decimal and tries custom parsers.
     * Falls back to default conversion if all custom parsers return null.
     *
     * @param price - The price to parse
     * @param network - The network to use
     * @returns Promise that resolves to the parsed asset amount
     */
    parsePrice(price: Price, network: Network): Promise<AssetAmount>;
    /**
     * Build payment requirements for this scheme/network combination
     *
     * @param paymentRequirements - The base payment requirements
     * @param supportedKind - The supported kind from facilitator (unused)
     * @param supportedKind.x402Version - The x402 version
     * @param supportedKind.scheme - The logical payment scheme
     * @param supportedKind.network - The network identifier in CAIP-2 format
     * @param supportedKind.extra - Optional extra metadata regarding scheme/network implementation details
     * @param extensionKeys - Extension keys supported by the facilitator (unused)
     * @returns Payment requirements ready to be sent to clients
     */
    enhancePaymentRequirements(paymentRequirements: PaymentRequirements, supportedKind: {
        x402Version: number;
        scheme: string;
        network: Network;
        extra?: Record<string, unknown>;
    }, extensionKeys: string[]): Promise<PaymentRequirements>;
    /**
     * Parse Money (string | number) to a decimal number.
     * Handles formats like "$1.50", "1.50", 1.50, etc.
     *
     * @param money - The money value to parse
     * @returns Decimal number
     */
    private parseMoneyToDecimal;
    /**
     * Default money conversion implementation.
     * Converts decimal amount to the default stablecoin on the specified network.
     *
     * @param amount - The decimal amount (e.g., 1.50)
     * @param network - The network to use
     * @returns The parsed asset amount in the default stablecoin
     */
    private defaultMoneyConversion;
    /**
     * Convert decimal amount to token units (e.g., 0.10 -> 100000 for 6-decimal tokens)
     *
     * @param decimalAmount - The decimal amount to convert
     * @param decimals - The number of decimals for the token
     * @returns The token amount as a string
     */
    private convertToTokenAmount;
    /**
     * Get the default asset info for a network (typically USDC)
     *
     * @param network - The network to get asset info for
     * @returns The asset information including address, name, version, and decimals
     */
    private getDefaultAsset;
}
/**
 * Enables the payment of APIs using the x402 Bermuda payment protocol.
 *
 * This function wraps the native fetch API to automatically handle 402 Payment Required responses
 * by creating and sending payment headers. It will:
 * 1. Make the initial request
 * 2. If a 402 response is received, parse the payment requirements
 * 3. Create a payment header using the configured x402HTTPClient
 * 4. Retry the request with the payment header
 *
 * @param scheme - A valid Bermuda sub scheme:
 *   - "bermuda::deposit": Support deposit payments
 *     -> public payer+amount, payee total balance private
 *   - "bermuda::transfer": Support transfer payments
 *     -> private payer, payee total balance private
 *   - "bermuda::anyhow": Default to the transfer scheme,
 *     fallback to the deposit scheme if insufficient Bermuda balance
 * @param signer - The EVM signer for client operations.
 *   For EVM signers:
 *     Must support `readContract` for EIP-2612 gas sponsoring.
 *     Use `createWalletClient(...).extend(publicActions)` or `toClientEvmSigner(account, publicClient)`.
 * @param spender - The Bermuda spender key pair for the transfer scheme
 * @param fetch - The fetch function to wrap (typically globalThis.fetch)
 * @returns A wrapped fetch function that handles 402 responses automatically
 *
 * @example
 * ```typescript
 * import { x402Fetch } from '@bermuda/sdk';
 *
 * const x402Fetch = x402Fetch('bermuda::deposit', evmSigner);
 *
 * // Make a request that may require payment
 * const response = await x402Fetch('https://api.example.com/paid-endpoint');
 * ```
 *
 * @throws {Error} If no schemes are provided
 * @throws {Error} If the request configuration is missing
 * @throws {Error} If a payment has already been attempted for this request
 * @throws {Error} If there's an error creating the payment header
 */
export declare function x402Fetch(scheme: x402Scheme | 'bermuda::deposit' | 'bermuda::transfer' | 'bermuda::anyhow', signer?: ClientEvmSigner | WalletClient, // | AnySigner
spender?: KeyPair, fetch?: Fetch): Fetch;
