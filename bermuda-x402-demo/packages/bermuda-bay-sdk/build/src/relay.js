/**
 * Sends given calls to relayers, directly or via a broadcast server.
 *
 * @param url URL to either a specific relayer or the relay broadcast server
 * @param chainId Chain id
 * @param to Contract address
 * @param data Payload
 * @returns Transaction hash
 */
export async function relay(url, { chainId, to, data /*, ...rest*/ }) {
    const response = await fetch(url.endsWith('/relay') ? url : `${url.replace(/\/$/, '')}/relay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainId: Number(chainId), to, data /*, ...rest*/ })
    });
    if (!response.ok) {
        throw new Error(`Relay request failed with response status ${response.statusText}`);
    }
    return response.json().then(r => r.tx);
}
//# sourceMappingURL=relay.js.map