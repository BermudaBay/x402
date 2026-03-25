import { Provider, AbiCoder, Signer } from 'ethers';
import { IExtData, ITransferDetails, ProgressHandler, EthAddress, IPermit, PermitTuple, IFindUtxosResult, ISnapParams, IPayload, IDepositPermit, AnySigner, IComplianceManagerSignResponse, IComplianceManagerPubKey, IComplianceManagerRequest, IComplianceManagerBlackList, IComplianceManagerCheckResponse, ICommitmentEventCacheItem, ICommitmentEvent, IUtxoCacheItem } from './types.js';
import Utxo from './utxo.js';
export declare const CoreNamespace = "core";
export declare const CommitmentEventsKey = "commitment-events";
export declare const DummyAddress: string;
export declare const STX_DEPOSIT_COMPONENTS = 8;
export declare const STX_DEPOSIT_ID_SLOTS = 16;
export declare const STX_INDEXED_LEVELS = 15;
export declare function initBbSync(): Promise<{
    bbSync: any;
    Fr: any;
}>;
export declare function _debug(isDebug: any, ...args: any[]): void;
export declare function poseidon2(...items: bigint[]): bigint;
/** AbiCoder shared singleton. */
export declare const abi: AbiCoder;
/**
 * Encodes the internal `_transact` call used by compliance attestation.
 * This helper is only used for deposit payload attestation requests.
 */
export declare function encodeInternalTransactData(_args: any[], _extData: any[], _permit?: PermitTuple): string;
export declare const ZERO_BYTES_20: Uint8Array<ArrayBuffer>;
/** EIP-2616 Permit types. */
export declare const PERMIT_TYPES: {
    Permit: {
        name: string;
        type: string;
    }[];
};
/**
 * Creates a permit payload for an ERC-20 token contract that supports the
 * ERC-20 Permit extension.
 *
 * Throws an error if the token contract doesn't support the ERC-20 Permit
 * extension.
 *
 * @param signer The signer incl. provider.
 * @param token The token contract address.
 * @param amount The amount to permit.
 * @param spender The address that can spend the funds.
 * @param deadline Deadline until which the permit signature remains valid.
 * @returns Permit payload.
 */
export declare function getPermitPayload({ signer, token, amount, spender, deadline }: {
    signer: Signer;
    token: EthAddress;
    amount: bigint;
    spender: EthAddress;
    deadline: number | bigint;
}): Promise<IPayload>;
/**
 * Creates a permit signature for an ERC-20 token contract that supports the
 * ERC-20 Permit extension.
 *
 * Throws an error if the token contract doesn't support the ERC-20 Permit
 * extension.
 *
 * @param signer The signer incl. provider.
 * @param token The token contract address.
 * @param amount The amount to permit.
 * @param spender The address that can spend the funds.
 * @param deadline Deadline until which the permit signature remains valid.
 * @returns Permit payload.
 */
export declare function permit({ signer, token, amount, spender, deadline }: {
    signer: AnySigner;
    token: EthAddress;
    amount: bigint;
    spender: EthAddress;
    deadline: bigint;
}): Promise<IDepositPermit>;
export declare const NATIVE_ADDRESS_PATTERN: RegExp;
export declare const SHIELDED_ADDRESS_PATTERN: RegExp;
/** BN254 prime. */
export declare const BN254_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** keccak256("tornado") % BN254_FIELD_SIZE */
export declare const MERKLE_TREE_DEFAULT_ZERO = 21663839004416932945382355908790599225266501822907911457504978515578255421292n;
/** maximum length for stx input utxos */
export declare const MAX_STX_INPUT_UTXOS = 4;
/** minimum length for stx input utxos */
export declare const MIN_STX_INPUT_UTXOS = 2;
/** maximum length for stx output utxos */
export declare const MAX_STX_OUTPUT_UTXOS = 4;
/** minimum length for stx output utxos */
export declare const MIN_STX_OUTPUT_UTXOS = 4;
/** Writes given bigint to a big-endian Uint8Array. */
export declare function bigint2bytes(b: bigint, out?: Uint8Array): Uint8Array;
/** Converts a hex string to a safe bigint. */
export declare function hex2Bigint(value: any): bigint;
/** Reads given bytes as an unsigned big-endian bigint. */
export declare function bytes2bigint(buf: Uint8Array): bigint;
/** I2OSP(RFC 8017): non-negative integer to fixed-length big-endian bytes. */
export declare function I2OSP(value: number | bigint, length: number): Uint8Array;
/** OS2IP(RFC 8017): big-endian bytes to bigint. */
export declare function OS2IP(os: Uint8Array): bigint;
/** Branchless buffer equality check. */
export declare function equalBytes(actual: Uint8Array, expected: Uint8Array, length?: number): boolean;
/** Get n random bytes from a CSPRNG. */
export declare function randomBytes(n: number): Uint8Array;
/** Concat given byte arrays. */
export declare function concatBytes(...subarrays: Uint8Array[]): Uint8Array;
/**
 * Converts numbers, bigints, BigNumbers, and byte arrays to 0x-prefixed hex.
 * For (byte) arrays the len parameter is ignored and no padding is applied.
 * If passing in a hex string this is an identity function.
 * @param b An array-like, bigint, or number
 * @param byteLength Output byte length
 * @returns 0x-prefixed hex string
 */
export declare function hex(b: any, byteLength?: number): string;
/**
 * Converts a hex string to a byte array.
 * Handles both 0x-prefixed and plain hex strings.
 * @param h Hex string
 * @returns Byte array
 */
export declare function hex2bytes(h: string): Uint8Array;
export declare function utf82bytes(s: string): Uint8Array;
export declare function bytes2utf8(b: Uint8Array): string;
/**
 * Registers a progress handler for downstream apps.
 * All registered progress handlers are invoked with a human-readable message
 * payload during certain long-running SDK functions.
 *
 * @param handler Progress handler to register
 * @returns Cancellation function for the registered handler
 */
export declare function onprogress(handler: ProgressHandler): () => void;
/**
 * Reports progress during long-running ops.
 * @param desc Human-readable message
 */
export declare function progress(desc: string): void;
/** Calculates the extra data hash. */
export declare function getExtDataHash({ recipient, extAmount, relayer, fee, encryptedOutputs, unwrap, token, funder }: IExtData): bigint;
/**
 * Hashes a UTXO note and converts it to a field element as a bigint.
 * @param note The UTXO note to hash
 * @returns Bigint representation of the hashed note modulo BN254_FIELD_SIZE
 */
export declare function hashUtxoNote(note: any): bigint;
/**
 * Shuffles an array.
 * @param array Array to shuffle
 * @returns Shuffled array
 */
export declare function shuffle(array: any[]): any[];
/** Maps transact args from object to array form. */
export declare function mapTransactArgs([_args, _extData]: [any, any]): [any[], any[]];
/**
 * Sorts utxos in desc order by amount.
 *
 * @param {Utxo[]} utxos
 * @returns {Utxo[]} utxos
 */
export declare function sortDescByAmount(utxos?: Utxo[]): Utxo[];
/**
 * Sums all utxos amounts.
 *
 * @param {Utxo[]} utxos
 * @returns {BigNumber} total amount
 */
export declare function sumAmounts(utxos?: Utxo[]): bigint;
/** Filter events batched so that RPCs don't error out. */
export declare function queryFilterBatched(fromBlock: bigint, toBlock: bigint, contract: any, filter: any): Promise<any[]>;
/**
 * Find the base-2 logarithm of a bigint.
 * Taken from https://github.com/nodef/extra-bigint
 * @param x a bigint
 * @returns log₂(x)
 */
export declare function log2(x: bigint): bigint;
export declare function floor(x: bigint, decimals: number): bigint;
export declare function percentage(partialValue: number, totalValue: number): number;
/**
 * Returns "Transfer" events filtered by the passed-in from and to addresses.
 *
 * @param token Token contract address
 * @param from Address of the sender
 * @param to Address of the receiver
 * @param fromBlock Block number
 * @param toBlock Block number
 * @param provider Instance of an Ethers.js provider
 * @returns List of Transfer event details
 */
export declare function tokenTransferDetails({ token, from, to, fromBlock, toBlock, provider }: {
    token: EthAddress;
    from: EthAddress;
    to: EthAddress;
    fromBlock: bigint;
    toBlock: bigint;
    provider: Provider;
}): Promise<Array<ITransferDetails>>;
/**
 * Creates a contract listener that listens to the token's "Transfer" event
 * and calls the callback function whenever a transfer from sender to the
 * receiver occurs.
 *
 * @param token Token contract address
 * @param from Address of the sender
 * @param to Address of the receiver
 * @param provider Instance of an Ethers.js provider
 * @param callback Callback function to call whenever a transfer from the sender
 * to the recipient occurs
 * @returns An unsubscribe function
 */
export declare function tokenTransferListener({ token, from, to, provider, callback }: {
    token: EthAddress;
    from: EthAddress;
    to: EthAddress;
    provider: Provider;
    callback: (amount: bigint) => Promise<void>;
}): () => void;
/**
 * Calculates the difference between two arrays while keeping duplicates.
 *
 * @param a First array
 * @param b Second array
 * @returns Array which contains the difference between Array a and Array b
 */
export declare function difference(a: any[], b: any[]): any;
/**
 * Map optional permit payload into the tuple expected on-chain.
 * @param permit Optional permit details; deadline 0 means "no permit".
 * @returns Tuple matching the on-chain struct layout.
 */
export declare function buildPermitTuple(permit?: IPermit): PermitTuple;
/**
 * Merges two UTXO results while removing duplicate entries.
 *
 * @param a First UTXO result
 * @param b Second UTXO result
 * @returns Merged UTXO result (excluding duplicates)
 */
export declare function mergeFindUtxosResults(a: IFindUtxosResult, b: IFindUtxosResult): {
    [key: string]: Utxo[];
};
export declare function mergeCommitmentEvents(a: ICommitmentEvent[], b: ICommitmentEvent[]): any[];
export declare function invokeSnap({ snapId, method, params }: ISnapParams): Promise<any>;
/**
 * fetches deposit ids that belong to flagged addresses from compliance manager,
 * compliance manager updates the status all depsoit addresses based on predicate attestation request,
 * then creates the blacklist of corresponding deposit ids to the flagged addresses.
 * used in exclusion proof generation and utxo selection proccess
 *
 * @param baseUrl compliance manager server url
 *
 * @returns a arrays of black list string deposit ids
 */
export declare function fetchComplianceBlackList(baseUrl: string): Promise<IComplianceManagerBlackList>;
/**
 * fetches compliance manager public key
 * public key points should be added to the stx circuit input for signature verification
 * public key points should be set in pool contract for on chain verification of the proof public inputs
 *
 * @param baseUrl compliance manager server url
 *
 * @returns Compliance manager public key points (X, Y)
 */
export declare function fetchComplianceManagerPublicKey(baseUrl: string): Promise<IComplianceManagerPubKey>;
/**
 * compliance manager signs a user specific message on each deposit commiting to complaint address
 * @param baseUrl compliance manager server url
 * @param IComplianceManagerRequest includes the following the request data
 *   - `to` (string): Bermuda pool address
 *   - `from` (string): user address
 * @notice `from` should be the signer of signature
 *   - `data` (string): encoded data for the deposit tx
 * @notice predicate api ref https://docs.predicate.io/v2/applications/backend-api
 *   - `amount` (string): Deposit amount
 *   - `chain` (string): Chain name
 *   - `token` (string): Token address
 *   - `commitmentHash` (string): Commitment hash for the deposit (verification in the stx circuit)
 *   - `signature` (string): User's signature over hash(chainId, to, token, amount, depositId, commitmentHash)
 *   - `depositId` (string): Random deposit id

 *
 * @returns Compliance manager public key points (X, Y) and signature
 *  *   - `complianceManagerSignature` (string): Signature from the compliance manager keypair
 *  @notice should be verified in the stx circuit
 *   - `complianceManagerPublickeyPoints`: compliance managerPublic key points (pubkeyX, pubkeyY)
 *  @notice should be a part of public inputs to the stx circuit used to verify the compliance manager signature
 *  @notice should be stored in pool contract to verify the managerPublic key points inputs of the proof
 */
export declare function fetchComplianceManagerSignature(baseUrl: string, requests: IComplianceManagerRequest): Promise<IComplianceManagerSignResponse[]>;
/**
 * Checks the compliance of a deposit against Predicate API.
 * @param baseUrl Compliance manager server URL
 * @param IComplianceManagerRequest includes the following the request data
 *   - `to` (string): Bermuda pool address
 *   - `from` (string): user address
 * @notice `from` should be the signer of signature argument
 *   - `data` (string): encoded data for the deposit tx
 * @notice Predicate API ref https://docs.predicate.io/v2/applications/backend-api
 *   - `amount` (string): Deposit amount
 *   - `chain` (string): Chain name
 *   - `token` (string): Token address
 *   - `commitmentHash` (string): Commitment hash for the deposit (verification in the stx circuit)
 *   - `signature` (string): User's signature over hash(chainId, to, token, amount, depositId, commitmentHash)
 *   - `depositId` (string): Random deposit id
 *
 *  The attestation response should be verified onchain in the _transact function.
 *
 * @returns An array of sign responses over the deposit transactions from predicate, including:
 *   - `policy_id` (string): Identifier of the evaluated policy
 *  @notice `policy_id` should be the same as the _policyID in the pool contract
 *   - `is_compliant` (boolean): True if the request satisfied the configured policy.
 *   - `uuid` (string): unique attestation identifier
 *   - `expiration` (number): Expiration time as Unix timestamp (one hour on default).
 *   - `attester` (string): Attester public key or address.
 *   - `signature`: Hex-encoded cryptographic attestors signature over the attestation payload. Always 0x-prefixed.
 *  @notice `signature` should be verified on chain in the transact function
 */
export declare function fetchComplianceCheck(baseUrl: string, requests: IComplianceManagerRequest): Promise<IComplianceManagerCheckResponse>;
/**
 * Clamps given secret seed to a valid Curve25519 private key.
 * See https://cr.yp.to/ecdh.html "Computing secret keys".
 *
 * @param seed
 * @returns Clamped secret key
 */
export declare function curve25519Clamp(seed: Uint8Array): Uint8Array;
export declare function chainIdToName(chainId: string | number | bigint): "testenv" | "gnosis" | "base" | "base-sepolia" | "plasma-mainnet" | "plasma-testnet";
export declare function utxoSerializer(value: IUtxoCacheItem): string;
export declare function utxoDeserializer(text: string): IUtxoCacheItem;
export declare function commitmentEventSerializer(value: ICommitmentEventCacheItem): string;
export declare function commitmentEventDeserializer(text: string): ICommitmentEventCacheItem;
