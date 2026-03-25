import { Signer, TransactionReceipt } from 'ethers';
import { IConfig, EthAddress, HexString, IRegistryRecord } from './types.js';
export default function init(config: IConfig): {
    /**
     * Lists all registry entries.
     * @returns [ { nativeAddress, shieldedAddress, name }, ... ]
     */
    list(): Promise<IRegistryRecord[]>;
    /**
     * Searches for a particular shielded address entry.
     * @param shieldedAddress
     * @return { nativeAddress, shieldedAddress, name, expiry } Record
     */
    find(shieldedAddress: HexString): Promise<undefined | IRegistryRecord>;
    /**
     * Whether given shielded address is registered.
     * @param shieldedAddress Shielded addresss
     * @return Registered bool flag
     */
    isRegistered(shieldedAddress: HexString): Promise<boolean>;
    /**
     * Looks up a shielded by a native address or .bay name.
     * @param addressOrAlias Native address or .bay name
     * @return Shielded address string
     */
    bermudaAddressOf(addressOrAlias: EthAddress | `${string}.bay`): Promise<HexString>;
    /**
     * Looks up a native address by a shielded address or .bay name.
     * @param shieldedAddressOrAlias Shielded address or .bay name
     * @returns Native address
     */
    ethereumAddressOf(shieldedAddressOrAlias: HexString | `${string}.bay`): Promise<undefined | EthAddress>;
    /**
     * Looks up a name by a Bermuda or Ethereum address.
     * @param address Shielded address
     * @returns .bay name
     */
    aliasOf(address: HexString | EthAddress): Promise<string>;
    /**
     * Registers a shielded account including a name.
     * @param signer Ethers signer
     * @param shieldedAddress Shielded address
     * @param name .bay name
     * @param safeAddress Safe address (optional)
     */
    register(signer: Signer, shieldedAddress: HexString, name?: string, safeAddress?: EthAddress): Promise<TransactionReceipt>;
    /**
     * Resolves given input to a shielded address.
     *
     * @param {*} x Arbitrary user input
     * @returns Shielded address or undefined
     */
    resolveShieldedAddress(x: any): Promise<undefined | HexString>;
    /**
     * Resolves given input to a native address.
     *
     * @param {*} x Arbitrary user input
     * @returns Native address or undefined
     */
    resolveNativeAddress(x: any): Promise<undefined | EthAddress>;
    /**
     * Looks up an ENS name given a native address.
     *
     * @param {string} nativeAddress Native address
     * @returns {string} ENS name or null
     */
    lookupEnsName(nativeAddress: EthAddress): Promise<undefined | string>;
    /**
     * Looks up a GNS/Genome name given a native address.
     *
     * @param {string} nativeAddress Native address
     * @returns {string} GNS/Genome name or null
     */
    lookupGnoName(nativeAddress: EthAddress): Promise<undefined | string>;
};
