import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
async function getCircuitArtifacts(chainId, circuitName, threads) {
    const circuit = await import(`${import.meta.dirname}/circuits/${chainId}/${circuitName}.json`, {
        with: { type: 'json' }
    });
    const noir = new Noir(circuit.default);
    // Use /tmp for CRS cache — the default ~/.bb-crs is read-only in serverless envs
    const crsPath = process.env.BB_CRS_PATH ?? '/tmp/.bb-crs';
    const backend = new UltraHonkBackend(circuit.default.bytecode, { threads, crsPath });
    return { noir, backend };
}
export default function init(config) {
    const threads = config.proverThreads ||
        (navigator?.hardwareConcurrency > 1 && navigator.hardwareConcurrency - 1) ||
        1;
    const chainId = config.chainId.toString();
    return {
        async prove2x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'transact2x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        },
        async prove4x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'transact4x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        },
        async withdraw2x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'withdraw2x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        },
        async withdraw4x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'withdraw4x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        },
        async publicWithdraw2x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'publicWithdraw2x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        },
        async publicWithdraw4x4(inputs) {
            const { noir, backend } = await getCircuitArtifacts(chainId, 'publicWithdraw4x4', threads);
            const { witness } = await noir.execute(inputs);
            return backend.generateProof(witness, { keccakZK: true });
        }
    };
}
//# sourceMappingURL=prove.js.map