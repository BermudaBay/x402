// stealth.js stub — stealth addresses are not used in the x402 payment flow.
// Privacy comes from ZK proofs + UTXOs in core.js/ops.js, not stealth addresses.
const stub = () => { throw new Error('Stealth address functions not available in this demo') }
export default function initStealth(_config) {
  return { stealthSetup: stub, stealth: stub }
}
