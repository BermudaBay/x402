import { Contract, JsonRpcProvider } from 'ethers';
import chain from './chain.js';
import POOL_ABI from './abis/pool.abi.json' with { type: 'json' };
import REGISTRY_ABI from './abis/registry.abi.json' with { type: 'json' };
export default function getConfig(opts, _opts) {
    let config;
    if (typeof opts === 'string' && /^base-sepolia$/i.test(opts)) {
        config = { ...chain['base-sepolia'], ..._opts };
    }
    else if (typeof opts === 'string' && /^testenv$/i.test(opts)) {
        config = { ...chain['testenv'], ..._opts };
    }
    else if (typeof opts === 'string' && /^pull-poc$/i.test(opts)) {
        config = { ...chain['pull-poc'], ..._opts };
    }
    else {
        config = { ..._opts };
        console.warn('sdk.config', config);
    }
    if (typeof config.provider === 'string') {
        config.provider = new JsonRpcProvider(config.provider);
    }
    else {
        throw new Error('no provider configured');
    }
    if (typeof config.pool === 'string') {
        config.pool = new Contract(config.pool, POOL_ABI, {
            provider: config.provider
        });
    }
    if (typeof config.registry === 'string') {
        config.registry = new Contract(config.registry, REGISTRY_ABI, {
            provider: config.provider
        });
    }
    return config;
}
//# sourceMappingURL=config.js.map