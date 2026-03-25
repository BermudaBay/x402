import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment as _wrapFetchWithPayment } from '@x402/fetch';
import chain from './chain.js';
import getConfig from './config.js';
import initOps from './ops.js';
import { chainIdToName, initBbSync } from './utils.js';
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
export class x402BermudaClientScheme {
    scheme;
    signer;
    spender;
    static SUPPORTED_NETWORKS = new Set([31337, 84532]);
    permitSeconds = 100n;
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
    constructor(scheme, signer, spender) {
        this.scheme = scheme;
        this.signer = signer;
        this.spender = spender;
    }
    /**
     * Sets the permit validity in seconds; default is 100.
     * @param permitSeconds Validity period of EIP-2612 permits in seconds.
     */
    setPermitSeconds(permitSeconds) {
        this.permitSeconds = permitSeconds;
    }
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
    async createPaymentPayload(x402Version, paymentRequirements, context) {
        const chainId = Number(paymentRequirements.network.split(':').pop());
        if (x402Version !== 2)
            throw Error('Unknown version');
        if (paymentRequirements.scheme !== this.scheme)
            throw Error('Unknown scheme');
        if (!x402BermudaClientScheme.SUPPORTED_NETWORKS.has(chainId))
            throw Error('Unknown network');
        // const sdk = bermuda(chainIdToName(chainId))
        // await sdk._.initBbSync() //FIXME
        const ops = initOps(getConfig(chainIdToName(chainId)));
        await initBbSync();
        const fee = context?.extensions?.['facilitator-fee']
            ? BigInt((context?.extensions?.['facilitator-fee']).amount)
            : 0n;
        const total = BigInt(paymentRequirements.amount) + fee;
        const feePayee = context?.extensions?.['facilitator-fee']
            ? (context?.extensions?.['facilitator-fee']).payee
            : undefined;
        const _deposit = async () => {
            if (!this.signer.signMessage)
                throw new Error('The deposit scheme requires a standard signer');
            const { default: KeyPair } = await import('./keypair.js');
            // Derive a deterministic Bermuda KeyPair from the signer's address for
            // compliance signing. This is a demo workaround until the compliance
            // server handles signing externally (tracked as //FIXME in the SDK).
            const signerAddress = this.signer.account?.address ?? this.signer.address ?? '0x0000000000000000000000000000000000000000';
            const seedBytes = new TextEncoder().encode(`bermuda-compliance:${signerAddress.toLowerCase()}`);
            const userKeyPair = KeyPair.fromSeed(seedBytes);
            // The x402 payTo is an Ethereum address (40 hex chars).  Bermuda deposit
            // recipients must be shielded addresses (128 hex chars).  Derive a
            // deterministic shielded address from payTo so the merchant can claim funds.
            let payToShielded = paymentRequirements.payTo;
            const payToHex = payToShielded.replace(/^0x/, '');
            if (payToHex.length < 128) {
                const payToSeed = new TextEncoder().encode(`bermuda-merchant:${payToShielded.toLowerCase()}`);
                payToShielded = KeyPair.fromSeed(payToSeed).address();
            }
            // Use a unique depositId per transaction to prevent Predicate replay rejection.
            // Combine current ms timestamp with a 16-bit random suffix for uniqueness.
            const depositId = (BigInt(Date.now()) << 16n) | BigInt(Math.floor(Math.random() * 65536));
            return ops.deposit({
                signer: this.signer,
                token: paymentRequirements.asset,
                recipients: [{ to: payToShielded, amount: total - fee }]
            }, {
                depositId,
                relayer: feePayee,
                fee,
                permitSeconds: 60 * 5,
                userKeyPair,
            });
        };
        const _transfer = async () => {
            if (!this.spender)
                throw new Error('The transfer scheme requires a Bermuda signer');
            return ops.transfer({
                spender: this.spender,
                token: paymentRequirements.asset,
                recipients: [{ to: paymentRequirements.payTo, amount: total - fee }]
            }, { relayer: feePayee, fee });
        };
        let payload;
        switch (this.scheme) {
            case 'bermuda::deposit': {
                payload = await _deposit();
                break;
            }
            case 'bermuda::transfer': {
                payload = await _transfer();
                break;
            }
            case 'bermuda::anyhow': {
                if (this.spender) {
                    payload = await _transfer().catch(async (err) => {
                        if (!/cannot|insufficient|no.*utxos/i.test(err.message))
                            throw Error(`Unexpected transfer error: ${err.message}\n${err.stack}`);
                        return _deposit();
                    });
                }
                else {
                    payload = await _deposit();
                }
                break;
            }
            default:
                throw Error('Unknown scheme');
        }
        return { x402Version: 2, payload: payload };
    }
}
/**
 * EVM server implementation for the Bermuda payment scheme.
 */
export class x402BermudaServerScheme {
    scheme;
    moneyParsers = [];
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
    constructor(scheme) {
        this.scheme = scheme;
    }
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
    registerMoneyParser(parser) {
        this.moneyParsers.push(parser);
        return this;
    }
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
    async parsePrice(price, network) {
        // If already an AssetAmount, return it directly
        if (typeof price === 'object' && price !== null && 'amount' in price) {
            if (!price.asset) {
                throw new Error(`Asset address must be specified for AssetAmount on network ${network}`);
            }
            return {
                amount: price.amount,
                asset: price.asset,
                extra: price.extra || {}
            };
        }
        // Parse Money to decimal number
        const amount = this.parseMoneyToDecimal(price);
        // Try each custom money parser in order
        for (const parser of this.moneyParsers) {
            const result = await parser(amount, network);
            if (result !== null) {
                return result;
            }
        }
        // All custom parsers returned null, use default conversion
        return this.defaultMoneyConversion(amount, network);
    }
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
    enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys) {
        // Mark unused parameters to satisfy linter
        void supportedKind;
        void extensionKeys;
        return Promise.resolve(paymentRequirements);
    }
    /**
     * Parse Money (string | number) to a decimal number.
     * Handles formats like "$1.50", "1.50", 1.50, etc.
     *
     * @param money - The money value to parse
     * @returns Decimal number
     */
    parseMoneyToDecimal(money) {
        if (typeof money === 'number') {
            return money;
        }
        // Remove $ sign and whitespace, then parse
        const cleanMoney = money.replace(/^\$/, '').trim();
        const amount = parseFloat(cleanMoney);
        if (isNaN(amount)) {
            throw new Error(`Invalid money format: ${money}`);
        }
        return amount;
    }
    /**
     * Default money conversion implementation.
     * Converts decimal amount to the default stablecoin on the specified network.
     *
     * @param amount - The decimal amount (e.g., 1.50)
     * @param network - The network to use
     * @returns The parsed asset amount in the default stablecoin
     */
    defaultMoneyConversion(amount, network) {
        const assetInfo = this.getDefaultAsset(network);
        const tokenAmount = this.convertToTokenAmount(amount.toString(), assetInfo.decimals);
        return {
            amount: tokenAmount,
            asset: assetInfo.address,
            extra: {
                name: assetInfo.name,
                version: assetInfo.version
            }
        };
    }
    /**
     * Convert decimal amount to token units (e.g., 0.10 -> 100000 for 6-decimal tokens)
     *
     * @param decimalAmount - The decimal amount to convert
     * @param decimals - The number of decimals for the token
     * @returns The token amount as a string
     */
    convertToTokenAmount(decimalAmount, decimals) {
        const amount = parseFloat(decimalAmount);
        if (isNaN(amount)) {
            throw new Error(`Invalid amount: ${decimalAmount}`);
        }
        // Convert to smallest unit (e.g., for USDC with 6 decimals: 0.10 * 10^6 = 100000)
        const [intPart, decPart = ''] = String(amount).split('.');
        const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
        const tokenAmount = (intPart + paddedDec).replace(/^0+/, '') || '0';
        return tokenAmount;
    }
    /**
     * Get the default asset info for a network (typically USDC)
     *
     * @param network - The network to get asset info for
     * @returns The asset information including address, name, version, and decimals
     */
    getDefaultAsset(network) {
        // Map of network to USDC info including EIP-712 domain parameters
        // Each network has the right to determine its own default stablecoin that can be expressed as a USD string by calling servers
        const stablecoins = {
            'eip155:8453': {
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                name: 'USD Coin',
                version: '2',
                decimals: 6
            }, // Base mainnet USDC
            'eip155:84532': {
                address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                name: 'USDC',
                version: '2',
                decimals: 6
            }, // Base Sepolia USDC
            'eip155:9745': {
                address: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb',
                name: 'USDT0',
                version: '1',
                decimals: 6
            }, // Plasma mainnet USDT0
            'eip155:9746': {
                address: '0x502012b361AebCE43b26Ec812B74D9a51dB4D412',
                name: 'USDT0',
                version: '1',
                decimals: 6
            }, // Plasma testnet USDT0
            'eip155:100': {
                address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
                name: 'Wrapped XDAI',
                version: '1',
                decimals: 18
            }, // Gnosis WXDAI
            'eip155:31337': {
                address: chain.testenv.USDC,
                name: 'Mock USD Coin',
                version: '1',
                decimals: 6
            } // testenv mock USDC
        };
        const assetInfo = stablecoins[network];
        if (!assetInfo) {
            throw new Error(`No default asset configured for network ${network}`);
        }
        return assetInfo;
    }
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
export function x402Fetch(scheme, signer, // | AnySigner
spender, fetch = globalThis.fetch) {
    const client = new x402Client();
    const bermudaEvmScheme = new x402BermudaClientScheme(scheme, signer, spender);
    client.register('eip155:*', bermudaEvmScheme);
    return _wrapFetchWithPayment(fetch, client);
}
//# sourceMappingURL=x402.js.map