import { AbiCoder, Contract, isHexString, keccak256, ZeroHash, getBytes, Signature, Interface } from 'ethers';
import Utxo from './utxo.js';
import ERC20_PERMIT_ABI from './abis/erc20permit.abi.json' with { type: 'json' };
let bbSync = null;
let Fr = null;
export const CoreNamespace = 'core';
export const CommitmentEventsKey = 'commitment-events';
export const DummyAddress = '0x0101010101010101010101010101010101010101';
export const STX_DEPOSIT_COMPONENTS = 8;
export const STX_DEPOSIT_ID_SLOTS = 16;
export const STX_INDEXED_LEVELS = 15;
export async function initBbSync() {
    try {
        const { BarretenbergSync, Fr: FrInstance } = await import('@aztec/bb.js');
        bbSync = await BarretenbergSync.initSingleton();
        Fr = FrInstance;
        return { bbSync, Fr };
    }
    catch (error) {
        console.error('BbSync initialization failed:', error);
        throw error;
    }
}
//FIXME in bermudabay/bin this causes panics so we export initBbSync
if (process.env.INIT_BB) {
    const bbSyncInitPromise = initBbSync();
    await bbSyncInitPromise;
}
export function _debug(isDebug, ...args) {
    if (isDebug) {
        console.log(...args);
    }
}
export function poseidon2(...items) {
    const length = items.length;
    if (length < 1) {
        throw new Error('poseidon2(): empty input');
    }
    const inputs = items.map(item => {
        if (item < 0n || item >= BN254_FIELD_SIZE) {
            throw new Error(`poseidon2(): input out of range: ${item}`);
        }
        return Fr.fromBuffer(bigint2bytes(item));
    });
    const response = bbSync.poseidon2Hash(inputs);
    return bytes2bigint(response.toBuffer());
}
/** AbiCoder shared singleton. */
export const abi = AbiCoder.defaultAbiCoder();
const INTERNAL_TRANSACT_SELECTOR = '0xf2e6045f';
const INTERNAL_ARGS_TUPLE_TYPE = '(bytes,bytes32[],bytes32,bytes32[],bytes32[],uint256,bytes32,bytes,bytes32[],bytes32,uint256,bytes32)';
const INTERNAL_EXT_DATA_TUPLE_TYPE = '(address,int256,address,uint256,bytes[],bool,address,address)';
/**
 * Encodes the internal `_transact` call used by compliance attestation.
 * This helper is only used for deposit payload attestation requests.
 */
export function encodeInternalTransactData(_args, _extData, _permit) {
    const zeroBytes32 = `0x${'00'.repeat(32)}`;
    const permitDeadline = _permit ? _permit[0] : 0n;
    const permitV = _permit ? _permit[1] : 0;
    const permitR = _permit ? _permit[2] : zeroBytes32;
    const permitS = _permit ? _permit[3] : zeroBytes32;
    const params = abi.encode([
        INTERNAL_ARGS_TUPLE_TYPE,
        INTERNAL_EXT_DATA_TUPLE_TYPE,
        'uint256',
        'uint8',
        'bytes32',
        'bytes32'
    ], [_args, _extData, permitDeadline, permitV, permitR, permitS]);
    return `${INTERNAL_TRANSACT_SELECTOR}${params.slice(2)}`;
}
export const ZERO_BYTES_20 = new Uint8Array(20);
/** EIP-2616 Permit types. */
export const PERMIT_TYPES = {
    Permit: [
        {
            name: 'owner',
            type: 'address'
        },
        {
            name: 'spender',
            type: 'address'
        },
        {
            name: 'value',
            type: 'uint256'
        },
        {
            name: 'nonce',
            type: 'uint256'
        },
        {
            name: 'deadline',
            type: 'uint256'
        }
    ]
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
export async function getPermitPayload({ signer, token, amount, spender, deadline }) {
    if (!signer.provider)
        throw Error('The signer should have a provider attached');
    const { signature } = await permit({
        signer,
        token,
        amount,
        spender,
        deadline: BigInt(deadline)
    });
    const { v, r, s } = Signature.from(signature);
    const permitTuple = buildPermitTuple({ deadline, v, r, s });
    const owner = await signer.getAddress();
    const data = Interface.from(ERC20_PERMIT_ABI).encodeFunctionData('permit', [
        owner,
        spender,
        amount,
        ...permitTuple
    ]);
    return {
        chainId: await signer.provider
            .getNetwork()
            .then(network => network.chainId)
            .then(Number),
        to: token,
        data
    };
}
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
export async function permit({ signer, token, amount, spender, deadline }) {
    const _signer = signer; // mute type warnings
    if (typeof signer['authorize'] === 'function' && typeof signer.signTypedData === 'function') {
        // ethers
        if (!_signer.provider)
            throw Error('The signer should have a provider attached');
        const contract = new Contract(token, ERC20_PERMIT_ABI, { provider: _signer.provider });
        try {
            const [nonce, separator] = await Promise.all([
                contract.nonces(DummyAddress),
                contract.DOMAIN_SEPARATOR()
            ]);
            if (nonce !== 0n || getBytes(separator).length === 0) {
                throw new Error('ERC-20 Permit extension not supported');
            }
        }
        catch {
            throw new Error(`Contract ${token} doesn't support ERC-20 Permit extension`);
        }
        const name = await contract.name();
        const chainId = await _signer.provider.getNetwork().then(network => network.chainId);
        const owner = await _signer.getAddress();
        const value = amount;
        const nonce = await contract.nonces(owner);
        const signature = await _signer.signTypedData({
            name,
            version: '1',
            chainId,
            verifyingContract: token
        }, PERMIT_TYPES, {
            owner,
            spender,
            value,
            nonce,
            deadline
        });
        return { signature, deadline };
    }
    else if (typeof signer.signTypedData === 'function') {
        // viem
        if (!_signer.readContract)
            throw new Error('Requires a signer with public actions');
        const [name, nonce] = await Promise.all([
            _signer.readContract({
                address: token,
                abi: [{ inputs: [], name: 'name', outputs: [{ type: 'string' }], type: 'function' }],
                functionName: 'name'
            }),
            _signer.readContract({
                address: token,
                abi: [
                    {
                        inputs: [{ type: 'address' }],
                        name: 'nonces',
                        outputs: [{ type: 'uint256' }],
                        type: 'function'
                    }
                ],
                functionName: 'nonces',
                args: [_signer.address]
            })
        ]);
        const signature = await _signer.signTypedData({
            domain: {
                name,
                version: '1',
                chainId: await _signer.getChainId(),
                verifyingContract: token
            },
            types: {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' }
                ]
            },
            primaryType: 'Permit',
            message: { owner: _signer.address, spender, value: amount, nonce, deadline }
        });
        return { signature, deadline };
    }
    else {
        throw new Error('Invalid signer typer');
    }
}
export const NATIVE_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
export const SHIELDED_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{128}$/;
/** BN254 prime. */
export const BN254_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** keccak256("tornado") % BN254_FIELD_SIZE */
export const MERKLE_TREE_DEFAULT_ZERO = 21663839004416932945382355908790599225266501822907911457504978515578255421292n;
/** BigInt byte mask. */
const BIGINT_BYTE_MASK = 255n;
/** BigInt 8. */
const BIGINT_BYTE_SHIFT = 8n;
/** maximum length for stx input utxos */
export const MAX_STX_INPUT_UTXOS = 4;
/** minimum length for stx input utxos */
export const MIN_STX_INPUT_UTXOS = 2;
/** maximum length for stx output utxos */
export const MAX_STX_OUTPUT_UTXOS = 4;
/** minimum length for stx output utxos */
export const MIN_STX_OUTPUT_UTXOS = 4;
/** Writes given bigint to a big-endian Uint8Array. */
export function bigint2bytes(b, out = new Uint8Array(32)) {
    for (let i = out.byteLength - 1; i >= 0; --i) {
        out[i] = Number(b & BIGINT_BYTE_MASK);
        b >>= BIGINT_BYTE_SHIFT;
    }
    return out;
}
/** Converts a hex string to a safe bigint. */
export function hex2Bigint(value) {
    if (value === '0x')
        return 0n;
    if (!/^0x[a-fA-F0-9]+$/.test(value))
        throw new Error(`Expected a hex encoded number but got ${value}`);
    return BigInt(value);
}
/** Reads given bytes as an unsigned big-endian bigint. */
export function bytes2bigint(buf) {
    return buf.reduce((acc, byte) => (acc << BIGINT_BYTE_SHIFT) | (BigInt(byte) & BIGINT_BYTE_MASK), 0n);
}
/** I2OSP(RFC 8017): non-negative integer to fixed-length big-endian bytes. */
export function I2OSP(value, length) {
    const v = BigInt(value);
    if (v < 0n)
        throw new Error('I2OSP: negative integer');
    if (v >= 1n << BigInt(length * 8)) {
        throw new Error('I2OSP: integer too large');
    }
    return bigint2bytes(v, new Uint8Array(length));
}
/** OS2IP(RFC 8017): big-endian bytes to bigint. */
export function OS2IP(os) {
    return bytes2bigint(os);
}
/** Branchless buffer equality check. */
export function equalBytes(actual, expected, length = expected.byteLength) {
    let diff = 0;
    for (let i = 0; i < length; ++i) {
        diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
}
/** Get n random bytes from a CSPRNG. */
export function randomBytes(n) {
    return globalThis.crypto.getRandomValues(new Uint8Array(n));
}
/** Concat given byte arrays. */
export function concatBytes(...subarrays) {
    const out = new Uint8Array(subarrays.reduce((acc, cur) => acc + cur.length, 0));
    let offset = 0;
    for (const subarray of subarrays) {
        out.set(subarray, offset);
        offset += subarray.length;
    }
    return out;
}
/**
 * Converts numbers, bigints, BigNumbers, and byte arrays to 0x-prefixed hex.
 * For (byte) arrays the len parameter is ignored and no padding is applied.
 * If passing in a hex string this is an identity function.
 * @param b An array-like, bigint, or number
 * @param byteLength Output byte length
 * @returns 0x-prefixed hex string
 */
export function hex(b, byteLength = 32) {
    if (isHexString(b)) {
        return b;
    }
    else if (Array.isArray(b) || b instanceof ArrayBuffer || b instanceof Uint8Array) {
        return ('0x' +
            Array.from(b)
                .map(i => i.toString(16).padStart(2, '0'))
                .join(''));
    }
    else if (typeof b.toHexString === 'function') {
        const h = b.toHexString();
        const d = byteLength - (h.length - 2) / 2;
        return d ? '0x' + '00'.repeat(d) + h.slice(2) : h;
    }
    else if (typeof b === 'bigint' || typeof b === 'number') {
        return '0x' + b.toString(16).padStart(byteLength * 2, '0');
    }
    else {
        throw new TypeError('cannot convert given type to hex');
    }
}
/**
 * Converts a hex string to a byte array.
 * Handles both 0x-prefixed and plain hex strings.
 * @param h Hex string
 * @returns Byte array
 */
export function hex2bytes(h) {
    const hexString = h.startsWith('0x') ? h.slice(2) : h;
    if (hexString.length % 2 !== 0) {
        throw new TypeError('Hex string must have an even length');
    }
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        const byte = parseInt(hexString.substr(i, 2), 16);
        if (isNaN(byte)) {
            throw new TypeError('Invalid hex string');
        }
        bytes.push(byte);
    }
    return Uint8Array.from(bytes);
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export function utf82bytes(s) {
    return encoder.encode(s);
}
export function bytes2utf8(b) {
    return decoder.decode(b);
}
const progressHandlers = [];
/**
 * Registers a progress handler for downstream apps.
 * All registered progress handlers are invoked with a human-readable message
 * payload during certain long-running SDK functions.
 *
 * @param handler Progress handler to register
 * @returns Cancellation function for the registered handler
 */
export function onprogress(handler) {
    progressHandlers.push(handler);
    return function offprogress() {
        progressHandlers.splice(progressHandlers.indexOf(handler), 1);
    };
}
/**
 * Reports progress during long-running ops.
 * @param desc Human-readable message
 */
export function progress(desc) {
    progressHandlers.forEach(handler => handler(desc));
}
/** Calculates the extra data hash. */
export function getExtDataHash({ recipient, extAmount, relayer, fee, encryptedOutputs, unwrap, token, funder }) {
    const encodedData = abi.encode([
        'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes[] encryptedOutputs,bool unwrap,address token,address funder)'
    ], [[recipient, extAmount, relayer, fee, encryptedOutputs, unwrap, token, funder]]);
    const hash = keccak256(encodedData);
    return BigInt(hash) % BN254_FIELD_SIZE;
}
/**
 * Hashes a UTXO note and converts it to a field element as a bigint.
 * @param note The UTXO note to hash
 * @returns Bigint representation of the hashed note modulo BN254_FIELD_SIZE
 */
export function hashUtxoNote(note) {
    return BigInt(keccak256(hex(note))) % BN254_FIELD_SIZE;
}
/**
 * Shuffles an array.
 * @param array Array to shuffle
 * @returns Shuffled array
 */
export function shuffle(array) {
    let currentIndex = array.length;
    let randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element... FIXME use a csprng
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}
/** Maps transact args from object to array form. */
export function mapTransactArgs([_args, _extData]) {
    const args = [
        _args.proof,
        _args.publicInputs,
        _args.root,
        _args.inputNullifiers,
        _args.outputCommitments,
        _args.publicAmount,
        _args.extDataHash,
        _args.zkStorageProof,
        _args.zkStorageProofPublicInputs,
        _args.challenge,
        _args.blockNumber,
        _args.blockHash
    ];
    const extData = [
        _extData.recipient,
        _extData.extAmount,
        _extData.relayer,
        _extData.fee,
        _extData.encryptedOutputs,
        _extData.unwrap,
        _extData.token,
        _extData.funder
    ];
    return [args, extData];
}
/**
 * Sorts utxos in desc order by amount.
 *
 * @param {Utxo[]} utxos
 * @returns {Utxo[]} utxos
 */
export function sortDescByAmount(utxos = []) {
    return utxos.sort((a, b) => Number(b.amount - a.amount));
}
/**
 * Sums all utxos amounts.
 *
 * @param {Utxo[]} utxos
 * @returns {BigNumber} total amount
 */
export function sumAmounts(utxos = []) {
    return utxos.reduce((acc, cur) => acc + cur.amount, 0n);
}
/** Filter events batched so that RPCs don't error out. */
export async function queryFilterBatched(fromBlock, toBlock, contract, filter) {
    const batchSize = 50000n;
    let batchedEvents = [];
    let i = fromBlock;
    let batchToBlock;
    const currentBlockNumber = await contract.runner.provider.getBlockNumber();
    // eslint-disable-next-line no-constant-condition
    while (true) {
        batchToBlock = i + batchSize;
        if (batchToBlock > currentBlockNumber) {
            batchToBlock = currentBlockNumber;
        }
        const events = await contract.queryFilter(filter, i, batchToBlock);
        batchedEvents = [...batchedEvents, ...events];
        i += batchSize;
        if (i >= toBlock) {
            break;
        }
    }
    return batchedEvents;
}
/**
 * Find the base-2 logarithm of a bigint.
 * Taken from https://github.com/nodef/extra-bigint
 * @param x a bigint
 * @returns log₂(x)
 */
export function log2(x) {
    var n = x.toString(2).length - 1;
    return x <= 0n ? 0n : BigInt(n);
}
export function floor(x, decimals) {
    let y = 10n ** BigInt(decimals);
    return x / y;
}
export function percentage(partialValue, totalValue) {
    return (100 * partialValue) / totalValue;
}
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
export async function tokenTransferDetails({ token, from, to, fromBlock, toBlock, provider }) {
    const contract = new Contract(token, ['event Transfer(address indexed from, address indexed to, uint256 value)'], { provider });
    const filter = contract.filters.Transfer(from, to, null);
    const events = (await queryFilterBatched(fromBlock, toBlock, contract, filter));
    const details = [];
    for (const event of events) {
        const value = event.args[2];
        details.push({
            from,
            to,
            value
        });
    }
    return details;
}
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
export function tokenTransferListener({ token, from, to, provider, callback }) {
    const tokenContract = new Contract(token, ['event Transfer(address indexed from, address indexed to, uint256 value)'], { provider });
    tokenContract.on('Transfer', async (_from, _to, value) => {
        if (_from.toLocaleLowerCase() === from.toLocaleLowerCase() &&
            _to.toLocaleLowerCase() === to.toLocaleLowerCase()) {
            await callback(value);
        }
    });
    return () => {
        tokenContract.off('Transfer');
    };
}
/**
 * Calculates the difference between two arrays while keeping duplicates.
 *
 * @param a First array
 * @param b Second array
 * @returns Array which contains the difference between Array a and Array b
 */
// Source: https://stackoverflow.com/a/39811025
export function difference(a, b) {
    return [
        ...b.reduce((acc, v) => acc.set(v, (acc.get(v) || 0) - 1), a.reduce((acc, v) => acc.set(v, (acc.get(v) || 0) + 1), new Map()))
    ].reduce((acc, [v, count]) => acc.concat(Array(Math.abs(count)).fill(v)), []);
}
/**
 * Map optional permit payload into the tuple expected on-chain.
 * @param permit Optional permit details; deadline 0 means "no permit".
 * @returns Tuple matching the on-chain struct layout.
 */
export function buildPermitTuple(permit) {
    if (permit && permit.deadline) {
        return [BigInt(permit.deadline), permit.v, permit.r, permit.s];
    }
    return [0n, 0, ZeroHash, ZeroHash];
}
/**
 * Merges two UTXO results while removing duplicate entries.
 *
 * @param a First UTXO result
 * @param b Second UTXO result
 * @returns Merged UTXO result (excluding duplicates)
 */
export function mergeFindUtxosResults(a, b) {
    const utxos = { ...a };
    for (const key in b) {
        if (utxos[key]) {
            const combined = [...utxos[key], ...b[key]];
            // Filter out duplicate UTXO instances based on their index property.
            const unique = combined.filter((utxo, index, self) => {
                return index === self.findIndex(other => utxo.index === other.index);
            });
            utxos[key] = unique;
        }
        else {
            utxos[key] = b[key];
        }
    }
    return utxos;
}
export function mergeCommitmentEvents(a, b) {
    const events = new Map();
    for (const event of a) {
        events.set(event.index, event);
    }
    for (const event of b) {
        events.set(event.index, event);
    }
    return Array.from(events.values());
}
export async function invokeSnap({ snapId, method, params }) {
    return globalThis.ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
            snapId: snapId || 'local:http://localhost:8080',
            request: params ? { method, params } : { method }
        }
    });
}
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
export async function fetchComplianceBlackList(baseUrl) {
    const url = `${baseUrl.replace(/\/$/, '')}/blacklist`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fetching compliance blacklist failed with ${response.status}`);
    }
    const result = (await response.json());
    return result;
}
/**
 * fetches compliance manager public key
 * public key points should be added to the stx circuit input for signature verification
 * public key points should be set in pool contract for on chain verification of the proof public inputs
 *
 * @param baseUrl compliance manager server url
 *
 * @returns Compliance manager public key points (X, Y)
 */
export async function fetchComplianceManagerPublicKey(baseUrl) {
    const url = `${baseUrl.replace(/\/$/, '')}/public-key`;
    const response = await fetch(url);
    if (!response.ok) {
        let errBody = await response.text();
        throw new Error(`compliance public-key failed (${response.status}): ${errBody}`);
    }
    const pubkeyPoints = (await response.json());
    return { pubkeyX: BigInt(pubkeyPoints.pubkeyX), pubkeyY: BigInt(pubkeyPoints.pubkeyY) };
}
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
export async function fetchComplianceManagerSignature(baseUrl, requests) {
    const url = `${baseUrl.replace(/\/$/, '')}/sign`;
    const payload = {
        ...requests,
        msg_value: requests.msgValue
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload])
    });
    if (!response.ok) {
        let errBody = await response.text();
        throw new Error(`compliance sign failed (${response.status}): ${errBody}`);
    }
    const result = (await response.json());
    return result;
}
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
export async function fetchComplianceCheck(baseUrl, requests) {
    const url = `${baseUrl.replace(/\/$/, '')}/compliance-check`;
    const payload = {
        ...requests,
        msg_value: requests.msgValue
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload])
    });
    if (!response.ok) {
        let errBody = await response.text();
        throw new Error(`compliance sign failed (${response.status}): ${errBody}`);
    }
    const result = (await response.json());
    return result[0];
}
/**
 * Clamps given secret seed to a valid Curve25519 private key.
 * See https://cr.yp.to/ecdh.html "Computing secret keys".
 *
 * @param seed
 * @returns Clamped secret key
 */
export function curve25519Clamp(seed) {
    if (seed.length !== 32)
        throw Error('Curve25519 seed must be 32 bytes');
    seed[0] &= 248;
    seed[31] &= 127;
    seed[31] |= 64;
    return seed;
}
export function chainIdToName(chainId) {
    switch (Number(chainId)) {
        case 31337:
            return 'testenv';
        case 100:
            return 'gnosis';
        case 8453:
            return 'base';
        case 84532:
            return 'base-sepolia';
        case 9745:
            return 'plasma-mainnet';
        case 9746:
            return 'plasma-testnet';
        default:
            throw Error('Unknown chain id');
    }
}
export function utxoSerializer(value) {
    return JSON.stringify({
        block: String(value.block),
        utxos: value.utxos
    });
}
export function utxoDeserializer(text) {
    const parsed = JSON.parse(text);
    const block = BigInt(parsed.block);
    const utxos = {};
    for (const [key, value] of Object.entries(parsed.utxos)) {
        Object.assign(utxos, {
            [key]: value.map(rawUtxo => Utxo.fromJSON(rawUtxo))
        });
    }
    return {
        block,
        utxos
    };
}
export function commitmentEventSerializer(value) {
    return JSON.stringify({
        block: String(value.block),
        events: value.events.map((event) => ({
            commitment: event.commitment,
            index: String(event.index),
            encryptedOutput: event.encryptedOutput
        }))
    });
}
export function commitmentEventDeserializer(text) {
    const parsed = JSON.parse(text);
    const block = BigInt(parsed.block);
    const events = parsed.events.map(event => ({
        commitment: event.commitment,
        index: BigInt(event.index),
        encryptedOutput: event.encryptedOutput
    }));
    return {
        block,
        events
    };
}
//# sourceMappingURL=utils.js.map