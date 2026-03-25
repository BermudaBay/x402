import getConfig from './config.js';
import KeyPair from './keypair.js';
import Utxo from './utxo.js';
import initHyperpool from './hyperpool.js';
import initRegistry from './registry.js';
import initCore from './core.js';
import initFindUtxos from './find-utxos.js';
import { relay } from './relay.js';
import initSafe from './safe.js';
import initOps from './ops.js';
import initStealth from './stealth.js';
import { BN254_FIELD_SIZE, PERMIT_TYPES, bigint2bytes, hex, mapTransactArgs, sumAmounts, onprogress, progress, permit, poseidon2, initBbSync } from './utils.js';
import { OperationType } from './types.js';
import ERC20_ABI from './abis/erc20.abi.json' with { type: 'json' };
import WETH_ABI from './abis/weth.abi.json' with { type: 'json' };
import ERC4626_ABI from './abis/erc4626.abi.json' with { type: 'json' };
import POOL_ABI from './abis/pool.abi.json' with { type: 'json' };
import REGISTRY_ABI from './abis/registry.abi.json' with { type: 'json' };
import SAFE_ABI from './abis/safe.abi.json' with { type: 'json' };
import PROPOSE_TX_LIB_ABI from './abis/proposetxlib.abi.json' with { type: 'json' };
import SIGN_MESSAGE_HASH_LIB_ABI from './abis/signmsghashlib.abi.json' with { type: 'json' };
import MULTICALL_ABI from './abis/multicall.abi.json' with { type: 'json' };
import { encryptMessageCiphertext, decryptMessageCiphertext, splitMessageCiphertextPayload, calcMessageCiphertextTopic, publishSafeMessageCiphertext, SAFE_MSG_CIPHERTEXT_NONCE_LENGTH } from './safe-msg-ciphertext.js';
import { encodeStx, decodeStx } from './safe-utils.js';
import { IndexedMerkleTree, verifyExclusionProofs } from './indexed-merkle-tree.js';
import { x402Fetch } from './x402.js';
export default function init(opts, _opts) {
    const config = getConfig(opts, _opts);
    const ops = initOps(config);
    const { stealthSetup, stealth } = initStealth(config);
    const registry = initRegistry(config);
    const safe = initSafe(config, registry);
    const hyperpool = initHyperpool(config);
    const core = initCore(config, safe);
    const findUtxosModule = initFindUtxos(config);
    // safe = require('./safe')(config, poseidonHash, poseidonHash2, poseidonHash5)
    const publishSafeMessageCiphertextWithDefaults = (params) => {
        const chainId = params.chainId ?? config.chainId;
        const relayer = params.relayer ?? config.relayBroadcastEndpoint ?? config.relayer;
        return publishSafeMessageCiphertext({
            ...params,
            chainId,
            relayer
        });
    };
    return {
        // core methods
        deposit: ops.deposit,
        transfer: ops.transfer,
        withdraw: ops.withdraw,
        publicWithdraw: ops.publicWithdraw,
        previewTransferPlan: ops.previewTransferPlan,
        executeTransferPlan: ops.executeTransferPlan,
        previewWithdrawPlan: ops.previewWithdrawPlan,
        executeWithdrawPlan: ops.executeWithdrawPlan,
        executePublicWithdrawPlan: ops.executePublicWithdrawPlan,
        getTransactProof: core.getTransactProof,
        buildMerkleTree: core.buildMerkleTree,
        prepareTransact: core.prepareTransact,
        // stealth functions
        stealthSetup,
        stealth,
        // x402
        x402Fetch,
        // hyperpool methods
        transact: hyperpool.transact,
        // safe methods
        safeChallengeHash: safe.challengeHash,
        safeZkStorageProof: safe.fetchZkStorageProof,
        safeListTxs: safe.listTxs,
        shieldedToSafe: safe.shieldedToSafe,
        safeProposeTx: safe.proposePayload,
        safeProposeBatchTx: safe.proposeBatchPayload.bind(safe),
        safeConfirmTx: safe.confirmPayload,
        safeExecuteTx: safe.executePayload,
        // safe utils methods
        safeIsOwner: safe.utils.isOwner,
        safeGetTxHash: safe.utils.getSafeTxHash,
        safeSignTx: safe.utils.signSafeTx,
        safeRecoverSigner: safe.utils.recoverSigner,
        safeBuildSignatureBytes: safe.utils.buildSignatureBytes,
        // safe Mpecdh methods
        mpecdhIsDeployed: safe.mpecdh.isDeployed.bind(safe.mpecdh),
        mpecdhIsReady: safe.mpecdh.isReady.bind(safe.mpecdh),
        mpecdhCalcAddress: safe.mpecdh.calcAddress.bind(safe.mpecdh),
        mpecdhProposeDeployment: safe.mpecdh.proposeDeployment.bind(safe.mpecdh),
        mpecdhProposeDeploymentViaApproveHash: safe.mpecdh.proposeDeploymentViaApproveHash.bind(safe.mpecdh),
        mpecdhInitKeyExchange: safe.mpecdh.initKeyExchange.bind(safe.mpecdh),
        // registry methods
        registryList: registry.list,
        isRegistered: registry.isRegistered.bind(registry),
        bermudaAddressOf: registry.bermudaAddressOf,
        ethereumAddressOf: registry.ethereumAddressOf.bind(registry),
        aliasOf: registry.aliasOf,
        register: registry.register,
        resolveShieldedAddress: registry.resolveShieldedAddress.bind(registry),
        resolveNativeAddress: registry.resolveNativeAddress.bind(registry),
        lookupEnsName: registry.lookupEnsName,
        lookupGnoName: registry.lookupGnoName,
        // ABI
        ERC20_ABI,
        WETH_ABI,
        ERC4626_ABI,
        POOL_ABI,
        REGISTRY_ABI,
        SAFE_ABI,
        MULTICALL_ABI,
        PROPOSE_TX_LIB_ABI,
        SIGN_MESSAGE_HASH_LIB_ABI,
        // utils methods
        findUtxos: findUtxosModule.findUtxos,
        findUtxosUpTo: findUtxosModule.findUtxosUpTo,
        relay,
        sumAmounts,
        mapTransactArgs,
        hex,
        bigint2bytes,
        onprogress,
        permit,
        progress,
        encryptMessageCiphertext,
        decryptMessageCiphertext,
        splitMessageCiphertextPayload,
        calcMessageCiphertextTopic,
        publishSafeMessageCiphertext: publishSafeMessageCiphertextWithDefaults,
        encodeStx,
        decodeStx,
        poseidon2,
        verifyExclusionProofs,
        // constants
        BN254_FIELD_SIZE,
        SAFE_MSG_CIPHERTEXT_NONCE_LENGTH,
        PERMIT_TYPES,
        // types
        KeyPair,
        Utxo,
        IndexedMerkleTree,
        OperationType,
        // config
        config: config,
        _: { initBbSync }
    };
}
export { x402Scheme } from './types.js';
export { x402BermudaClientScheme, x402BermudaServerScheme, x402Fetch } from './x402.js';
export { default as KeyPair } from './keypair.js';
export { default as Utxo } from './utxo.js';
export { getAccount } from './account.js';
//# sourceMappingURL=index.js.map