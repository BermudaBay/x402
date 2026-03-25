import { IRelayRequest, Hex32 } from './types.js';
/**
 * Sends given calls to relayers, directly or via a broadcast server.
 *
 * @param url URL to either a specific relayer or the relay broadcast server
 * @param chainId Chain id
 * @param to Contract address
 * @param data Payload
 * @returns Transaction hash
 */
export declare function relay(url: string, { chainId, to, data }: IRelayRequest): Promise<Hex32>;
