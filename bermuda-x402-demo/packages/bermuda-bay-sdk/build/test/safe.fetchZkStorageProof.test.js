import fetch from 'node-fetch';
import { JsonRpcProvider } from 'ethers';
import initSafe from '../src/safe.js';
globalThis.fetch = fetch;
const DEFAULT_MPT_PROVER = 'http://localhost:4190';
const mptProver = process.env.MPT_PROVER ?? DEFAULT_MPT_PROVER;
const describeFn = (process.env.CI ? describe.skip : describe);
describeFn('safe.fetchZkStorageProof', function () {
    // from mpt-circuit/test.sh
    const SAFE_ADDRESS = '0xb4B0330341825F9D65255b2eEFc125933359A590';
    const STX_HASH = '0x577e3b330d43f45f328baf768401dd8b4952d17bcac9f16cc1b39bf3ec22a9ed';
    const CHAIN_ID = 84532n;
    let config;
    before(async function () {
        this.timeout(900_000);
        try {
            const res = await fetch(`${mptProver}/status`);
            if (!res.ok) {
                this.skip();
            }
        }
        catch (_) {
            this.skip();
        }
        config = {
            chainId: CHAIN_ID,
            mptProver,
            provider: new JsonRpcProvider('https://base-sepolia-rpc.publicnode.com')
        };
    });
    it('fetches a storage proof', async function () {
        this.timeout(900_000);
        const safeModule = initSafe(config);
        const proof = await safeModule.fetchZkStorageProof(SAFE_ADDRESS, STX_HASH);
        console.dir({
            proof: proof.proof,
            challenge: proof.challenge,
            blockHash: proof.blockHash,
            blockNumber: proof.blockNumber.toString(),
            publicInputs: proof.publicInputs
        }, { depth: null });
    });
});
//# sourceMappingURL=safe.fetchZkStorageProof.test.js.map