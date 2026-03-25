import { Wallet } from 'ethers';
import { HexString, IConfig, IPayload, IStealthParams, IStealthSetupParams, StealthAction } from './types.js';
export default function init(config: IConfig): {
    /**
     * Create a stealth address, optionally fund it from the shielded pool
     * compose public contract interactions, and finally optionally reshield
     * funds. Stealth action sandwiched inbetween the shielded pools gateways.
     *
     * @param params.id The stealth nonce to use in derivation.
     * @param params.spender Bermuda key pair that's e.g. used for proof generation.
     * @param params.unshield.token The optionally initial unshield token.
     * @param params.unshield.amount The unshield amount to be used.
     * @param params.reshield.to Recipient to optionally reshield to.
     * @param params.reshield.token The optional reshield token.
     * @param params.reshield.amount The optional reshield amount to be used.
     * @param params.permit.token The token contract address.
     * @param params.permit.amount The amount to permit.
     * @param params.permit.spender The address that can spend the funds.
     * @param params.permit.deadline Deadline until which the permit signature remains valid.
     * @returns Stealth action multicall payload.
     */
    stealth(params: IStealthParams, action: StealthAction): Promise<{
        payload: IPayload;
        signer: Wallet;
    }>;
    /**
     * Setup a stealth address, i.e. fund it through a WETH to ETH withdrawal from
     * the shielded pool and upgrade it to a 7702 account with multicall support.
     *
     * Conditionally packs an unshield and 7702 authorization into the payload.
     *
     * @param params.shieldedKeyPair Shielded key pair to derive the stealth address from.
     * @param params.id Nonce to derive the stealth address with.
     * @param params.gasTank Optional amount of ETH to fund the stealth address with.
     * @param params.relayerFee Optional relayer fee in ETH.
     * @param params.relayer Optional relayer address as fixed payee.
     * @returns Payload to be sent through a relayer.
     */
    stealthSetup({ shieldedKeyPair, id, gasTank, relayerFee, relayer }: IStealthSetupParams): Promise<IPayload | {
        authorizationList: HexString[];
    }>;
};
