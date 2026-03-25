import { IConfig, IFindUtxosInputs, IFindUtxosResult, IFindUtxosUpToInputs, IFindUtxosUpToOutputs, IFindFlaggedUtxos, IFindFlaggedUtxosResult } from './types.js';
export default function init(config: IConfig): {
    /**
     * Lists unspent transaction outputs by given key pair.
     *
     * @param pool pool contract
     * @param keypair spender's shielded account keypair
     * @param tokens ERC20 token addresses
     * @param excludeSpent Exclude spent transactions
     * @param excludeOthers Exclude others UTXOs
     * @param from block height offset to start search from
     * @returns Unspent tx outputs grouped by token address
     */
    findUtxos({ pool, keypair, tokens, excludeSpent, excludeOthers, from }: IFindUtxosInputs): Promise<IFindUtxosResult>;
    /**
     * Finds all flagged utxos for the specified token.
     *
     * @param pool pool contract
     * @param keypair spender's shielded account keypair
     * @param excludeSpent exclude spent transactions
     * @param excludeOthers exclude others UTXOs
     * @param from block height offset to start search from
     * @param token ERC20 token address
     * @param excludeUtxos utxos to exclude
     * @returns Flagged unspent tx outputs for given token
     */
    findFlaggedUtxos({ pool, keypair, excludeSpent, excludeOthers, from, token, excludeUtxos }: IFindFlaggedUtxos): Promise<IFindFlaggedUtxosResult>;
    /**
     * Select minimal required number of utxos to reach given target amount and token
     * This function can operate in two modes: finding compliant (clean) funds or
     * specifically targeting uncompliant (blacklisted) funds for a selective public withdraw.
     * @param pool pool contract
     * @param keypair spender's shielded account keypair
     * @param peers Peer shielded addresses
     * @param excludeSpent Exclude spent transactions
     * @param excludeOthers Exclude others UTXOs
     * @param from block height offset to start search from
     * @param token ERC20 token address
     * @param amount Target value to accumulate
     * @param results Number of UTXOs to return
     * @param excludeUtxos UTXOs to ignore in the search (for recursive filtering)
     * @param targetCompliant If true, finds clean funds. If false, finds blacklisted funds.
     * @returns Unspent tx outputs for given token
     */
    findUtxosUpTo({ pool, keypair, excludeSpent, excludeOthers, from, token, amount, results, excludeUtxos, targetCompliant }: IFindUtxosUpToInputs): Promise<IFindUtxosUpToOutputs>;
};
