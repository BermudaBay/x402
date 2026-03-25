import KeyPair from './keypair.js';
import { utf82bytes } from './utils.js';
const GLOBAL_SEED = utf82bytes('BERMUDA_ACCOUNT');
//TODO
// or export { getBermudaAccount, getBurnerAccount }
// or export {
//   bermuda({ signer?, seed?, snap?, id? })::{
//     ".snap connects to set snap origin or if true to default",
//.    "if .id is non-zero (default is zero) then mix the id into the sig/seed => *1*-eoa/seed=>*x*-bermudaaccounts"
//   },
//   burner({spender, id })::{"if 7702 not deployed sends it thru the relay"} => viemAccount
//.    TODO requires same burner on all chains i.e. take out chainid from stealth seed
// }
// => or best union of both
//TODO also correctly export x402 stuff under sdk.
//TODO inocorporate facitator-fee and payment-identifier extensions into *new* Paywall abstraction from @x402/paywall
//TODO intorudce new pay() function that uses x402 under the hood (correctly setting payment-identifier and facilitatoe-fee)
//.      - look at base account sdk for proven dx and pay() interface
//TODO maybe also set the extensions in bermuda::x402ClientScheme::createPaymentPayload() -> yes
//TODO also intoruce only pay button .tsx that handles wallet-connecting and paying (using pay()) -> ripoff from paywall
/**
 * Derives a Berrmuda account (key pair), either
 * - from a seed
 * or
 * - from a signature
 * @param signer Any signer
 * @param seed UTF8 or hex string account seed
 * @returns Bermuda key pair
 */
export async function getAccount({ signer, seed }) {
    if (seed) {
        return KeyPair.fromSeed(seed);
    }
    else if (signer) {
        let sig;
        if (typeof signer['authorize'] === 'function' && typeof signer.signMessage === 'function') {
            // ethers
            sig = await signer.signMessage(GLOBAL_SEED);
        }
        else if (typeof signer.signMessage === 'function') {
            // viem
            sig = await signer.signMessage({
                message: { raw: GLOBAL_SEED }
            });
        }
        else {
            throw new Error('Invalid signer typer');
        }
        return KeyPair.fromSeed(sig);
    }
    else {
        throw new Error('Either seed or signer must be given');
    }
}
//# sourceMappingURL=account.js.map