// @ts-nocheck
import { keccak256, toUtf8Bytes, toUtf8String, getDefaultProvider, JsonRpcProvider, parseUnits } from 'ethers';
import { NATIVE_ADDRESS_PATTERN, SHIELDED_ADDRESS_PATTERN, hex2bytes, queryFilterBatched } from './utils.js';
export default function init(config) {
    // we lookup .eth .gno names on mainnet
    const GNS_REGISTRY = '0x4f132A7e39B1D717B39C789eB9EC1e790092042B';
    const ethereum = getDefaultProvider('https://ethereum-rpc.publicnode.com');
    const gnosis = new JsonRpcProvider('https://rpc.gnosischain.com', {
        name: 'xdai',
        chainId: 100,
        ensAddress: GNS_REGISTRY
    });
    return {
        /**
         * Lists all registry entries.
         * @returns [ { nativeAddress, shieldedAddress, name }, ... ]
         */
        async list() {
            return queryFilterBatched(config.startBlock, await config.provider.getBlockNumber().then(BigInt), config.registry, config.registry.filters.Registered()).then(events => events.map(({ args }) => ({
                nativeAddress: args.nativeAddress,
                shieldedAddress: args.shieldedAddress,
                name: args.name
            })));
        },
        /**
         * Searches for a particular shielded address entry.
         * @param shieldedAddress
         * @return { nativeAddress, shieldedAddress, name, expiry } Record
         */
        async find(shieldedAddress) {
            return this.list().then(l => l.find(entry => entry.shieldedAddress === shieldedAddress));
        },
        /**
         * Whether given shielded address is registered.
         * @param shieldedAddress Shielded addresss
         * @return Registered bool flag
         */
        async isRegistered(shieldedAddress) {
            const entry = await this.find(shieldedAddress);
            return !!entry;
        },
        /**
         * Looks up a shielded by a native address or .bay name.
         * @param addressOrAlias Native address or .bay name
         * @return Shielded address string
         */
        async bermudaAddressOf(addressOrAlias) {
            if (addressOrAlias.endsWith('.bay')) {
                return config.registry.shieldedAddressOfNameHash(keccak256(toUtf8Bytes(addressOrAlias.toLowerCase())));
            }
            else {
                return config.registry.shieldedAddressOf(addressOrAlias);
            }
        },
        /**
         * Looks up a native address by a shielded address or .bay name.
         * @param shieldedAddressOrAlias Shielded address or .bay name
         * @returns Native address
         */
        async ethereumAddressOf(shieldedAddressOrAlias) {
            if (shieldedAddressOrAlias.endsWith('.bay')) {
                const shieldedAddress = await this.shieldedAddressOfName(shieldedAddressOrAlias);
                return this.nativeAddressOf(shieldedAddress);
            }
            else {
                return this.find(shieldedAddressOrAlias).then(r => r?.nativeAddress);
            }
        },
        /**
         * Looks up a name by a Bermuda or Ethereum address.
         * @param address Shielded address
         * @returns .bay name
         */
        async aliasOf(address) {
            if (NATIVE_ADDRESS_PATTERN.test(address)) {
                return config.registry.nameOfNativeAddress(address).then((hexString) => toUtf8String(hex2bytes(hexString)));
            }
            else {
                return config.registry.nameOfShieldedAddress(address).then((hexString) => toUtf8String(hex2bytes(hexString)));
            }
        },
        /**
         * Registers a shielded account including a name.
         * @param signer Ethers signer
         * @param shieldedAddress Shielded address
         * @param name .bay name
         * @param safeAddress Safe address (optional)
         */
        async register(signer, shieldedAddress, name = '', safeAddress) {
            // if (safeAddress) {
            //   const _safeAddress = ethers.getAddress(safeAddress)
            //   const ethAdapter = new EthersAdapter({
            //     ethers,
            //     signerOrProvider: signer
            //   })
            //   const safeSigner = await Safe.create({
            //     ethAdapter,
            //     safeAddress: _safeAddress
            //   })
            //   const registryAddress = await config.registry.getAddress()
            //   const rawData = config.registry.interface.encodeFunctionData(
            //     'register',
            //     [
            //       Buffer.from(shieldedAddress.replace('0x', ''), 'hex'),
            //       Buffer.from(name, 'utf8')
            //     ]
            //   )
            //   const safeTxData = {
            //     to: ethers.getAddress(registryAddress),
            //     data: rawData,
            //     value: '0'
            //   }
            //   // const safeTx = await safe.createTransaction({ safeTransactionData })
            //   // const signedSafeTx = await safe.signTransaction(
            //   //   safeTx,
            //   //   'eth_signTypedData_v4'
            //   // )
            //   // const result = await safe.executeTransaction(signedSafeTx)
            //   // return result
            //   const safeTx = await safeSigner.createTransaction({
            //     transactions: [safeTxData]
            //   })
            //   const chainId = await signer.provider
            //     .getNetwork()
            //     .then(({ chainId }) => chainId)
            //   const apiKit = new SafeApiKit({ chainId })
            //   // Deterministic hash based on tx params
            //   const safeTxHash = await safeSigner.getTransactionHash(safeTx)
            //   // Sign Safe tx thereby adding first confirmation
            //   const senderSignature = await safeSigner.signHash(safeTxHash)
            //   await apiKit.proposeTransaction({
            //     safeAddress: _safeAddress,
            //     safeTransactionData: safeTx.data,
            //     safeTxHash,
            //     senderAddress: ethers.getAddress(signer.address),
            //     senderSignature: senderSignature.data
            //   })
            //   return { safeTxHash }
            // } else {
            return config.registry
                .connect(signer)
                .register(Buffer.from(shieldedAddress.replace('0x', ''), 'hex'), Buffer.from(name, 'utf8'), { gasPrice: parseUnits('101', 'gwei'), gasLimit: 1000000 })
                .then((response) => {
                return response.hash;
            });
        },
        /**
         * Resolves given input to a shielded address.
         *
         * @param {*} x Arbitrary user input
         * @returns Shielded address or undefined
         */
        async resolveShieldedAddress(x) {
            if (SHIELDED_ADDRESS_PATTERN.test(x)) {
                return x;
            }
            else if (x.endsWith('.bay') || NATIVE_ADDRESS_PATTERN.test(x)) {
                return this.shieldedAddressOf(x).then(r => (r.length === 130 ? r : undefined));
            }
            else if (x.endsWith('.eth')) {
                const nativeAddress = await ethereum.resolveName(x);
                if (!nativeAddress)
                    return undefined;
                return this.shieldedAddressOf(nativeAddress).then(r => (r?.length === 130 ? r : undefined));
            }
            else {
                // assume it is a cirlces ubi name
                const safeAddress = await fetch(`https://api.circles.garden/api/users/${x}`)
                    .then(r => (r.status !== 200 ? undefined : r.json()))
                    .then(usr => usr?.data?.safeAddress);
                if (!safeAddress) {
                    return undefined;
                }
                else {
                    return this.shieldedAddressOf(safeAddress).then(r => (r.length === 130 ? r : undefined));
                }
            }
        },
        /**
         * Resolves given input to a native address.
         *
         * @param {*} x Arbitrary user input
         * @returns Native address or undefined
         */
        async resolveNativeAddress(x) {
            if (NATIVE_ADDRESS_PATTERN.test(x)) {
                return x;
            }
            else if (x.endsWith('.eth')) {
                return ethereum.resolveName(x).then(y => y ?? undefined);
            }
            else if (x.endsWith('.gno')) {
                return gnosis.resolveName(x).then(y => y ?? undefined);
            }
            else if (SHIELDED_ADDRESS_PATTERN.test(x)) {
                return this.nativeAddressOf(x).then(r => (r?.length === 42 ? r : undefined));
            }
            else if (x.endsWith('.bay')) {
                return this.nativeAddressOf(x);
            }
            else {
                // assume it is a cirlces ubi name
                return fetch(`https://api.circles.garden/api/users/${x}`)
                    .then(r => (r.status !== 200 ? undefined : r.json()))
                    .then(usr => usr?.data?.safeAddress);
            }
        },
        /**
         * Looks up an ENS name given a native address.
         *
         * @param {string} nativeAddress Native address
         * @returns {string} ENS name or null
         */
        async lookupEnsName(nativeAddress) {
            return ethereum.lookupAddress(nativeAddress).then(name => name ?? undefined);
        },
        /**
         * Looks up a GNS/Genome name given a native address.
         *
         * @param {string} nativeAddress Native address
         * @returns {string} GNS/Genome name or null
         */
        async lookupGnoName(nativeAddress) {
            return gnosis.lookupAddress(nativeAddress).then(name => name ?? undefined);
        }
    };
}
//# sourceMappingURL=registry.js.map