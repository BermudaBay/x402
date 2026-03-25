import KeyPair from './keypair';
import { AnySigner } from './types';
/**
 * Derives a Berrmuda account (key pair), either
 * - from a seed
 * or
 * - from a signature
 * @param signer Any signer
 * @param seed UTF8 or hex string account seed
 * @returns Bermuda key pair
 */
export declare function getAccount({ signer, seed }: {
    signer?: AnySigner;
    seed?: string;
}): Promise<KeyPair>;
