// mpecdh stub — Safe multisig MPECDH is not used in the Bermuda x402 demo
const stub = () => { throw new Error('mpecdh: not available in demo') }
const calcMPECDHAddress = stub
const isMPECDHDeployed = stub
const isMPECDHReady = stub
const proposeDeploymentViaApproveHash = stub
const proposeMPECDHDeployment = stub
const mpecdh = stub

export default function initMecdh(_config) {
    return {
        async isDeployed(_safeAddress) { return false },
        async isReady(_safeAddress) { return false },
        async calcAddress(safeAddress, _owners) { return calcMPECDHAddress(safeAddress) },
        async proposeDeployment(_signer, safeAddress) { return proposeMPECDHDeployment(safeAddress) },
        async proposeDeploymentViaApproveHash(_signer, safeAddress) { return proposeDeploymentViaApproveHash(safeAddress) },
        async initKeyExchange(mpecdhAddress) { return mpecdh(mpecdhAddress) }
    }
}
