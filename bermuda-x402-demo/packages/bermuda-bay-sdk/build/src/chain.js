export default {
    'base-sepolia': {
        chainId: 84532n,
        merkleTreeHeight: 23,
        startBlock: 37577652n,
        provider: 'https://base-sepolia-rpc.publicnode.com',
        keyringSnap: 'https://api.tilapialabs.xyz/keyring-snap',
        mptProver: 'https://api.tilapialabs.xyz/mpt-prover',
        relayer: 'https://api.tilapialabs.xyz/relayer/relay',
        pool: '0x8Dd5ECEBBc23107fa0C000Fd687FF33021a32896',
        registry: '0x60e6570C57fCbc8a50E50737b5E69198e646E09B',
        // TODO
        complianceManager: '',
        signMsgHashLib: '0xb8b9C7B412f727142b1ce59e4ab4800086f163AE',
        proposeTxLib: '0x96A1Bc50A7ca06BbcedCaa744C09019555076d11',
        multiCall: '0x961cDc889f9AB59cff6E1Cd20E771a7932883C6f',
        multiSend: '0x218543288004CD07832472D464648173c77D7eB7',
        multiSendCallOnly: '0xA83c336B20401Af773B6219BA5027174338D1836',
        USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        WETH: '0x4200000000000000000000000000000000000006',
        sUSDC: '0x2a54D0B676c7d307E0d52Cf28E412B8B73a09517',
        erc5564Announcer: '0xEC1BbA8F3E1850C1133A797D497817b56Ec12312',
        erc6538Registry: '0xf410eECB49F18793Aba32e0eFB7B52277d4d7687',
        compliance: '0x48f0910FA39F56b23aB96A5fa8955E915CA908AC',
        // Mock Predicate registry
        predicateRegistry: '0xc9fEA0b5Ba9208166f9a315B93fe52C44c396bf6',
        get storagePrefix() {
            return `bermuda:${this.chainId}:${this.pool.toLowerCase()}`;
        }
    },
    testenv: {
        chainId: 31337n,
        startBlock: 0n,
        merkleTreeHeight: 23,
        provider: 'http://localhost:8545',
        relayer: 'http://localhost:4191',
        mptProver: 'http://localhost:4190',
        complianceManager: 'http://localhost:4195',
        registry: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        pool: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        USDC: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
        WETH: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        signMsgHashLib: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
        proposeTxLib: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
        multiCall: '0x8ce361602B935680E8DeC218b820ff5056BeB7af',
        multiSend: '0x218543288004CD07832472D464648173c77D7eB7',
        multiSendCallOnly: '0xA83c336B20401Af773B6219BA5027174338D1836',
        erc5564Announcer: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
        erc6538Registry: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
        compliance: '0xb19b36b1456E65E3A6D514D3F715f204BD59f431',
        predicateRegistry: '0xA15BB66138824a1c7167f5E85b957d04Dd34E468',
        get storagePrefix() {
            return `bermuda:${this.chainId}:${this.pool.toLowerCase()}`;
        }
    },
    'pull-poc': {
        chainId: 31337n,
        provider: 'http://localhost:8545',
        startBlock: 0n,
        relayer: 'http://localhost:4191',
        mockBackend: 'http://localhost:4192',
        mptProver: 'http://localhost:4190',
        complianceManager: 'http://localhost:4195',
        registry: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        pool: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        merkleTreeHeight: 23,
        debug: true, // Log a lot
        operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        beneficiary: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        USDC: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
        WETH: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        foxConnectUS: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
        signMsgHashLib: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
        proposeTxLib: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
        multiCall: '0x8ce361602B935680E8DeC218b820ff5056BeB7af',
        multiSend: '0x218543288004CD07832472D464648173c77D7eB7',
        multiSendCallOnly: '0xA83c336B20401Af773B6219BA5027174338D1836',
        erc5564Announcer: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
        erc6538Registry: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
        compliance: '0xb19b36b1456E65E3A6D514D3F715f204BD59f431',
        predicateRegistry: '0xA15BB66138824a1c7167f5E85b957d04Dd34E468',
        get storagePrefix() {
            return `bermuda:${this.chainId}:${this.pool.toLowerCase()}`;
        }
    }
};
//# sourceMappingURL=chain.js.map