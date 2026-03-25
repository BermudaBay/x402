import Utxo from './utxo.js';
import initStorage, { fileSystemStorage } from './storage.js';
import { commitmentEventDeserializer, commitmentEventSerializer, CommitmentEventsKey, CoreNamespace, mergeCommitmentEvents, utxoDeserializer, utxoSerializer, fetchComplianceBlackList, hex, mergeFindUtxosResults, queryFilterBatched, sortDescByAmount, STX_DEPOSIT_COMPONENTS } from './utils.js';
export default function init(config) {
    const utxoNamespace = 'utxos';
    const coreNamespace = CoreNamespace;
    let utxoProvider;
    if (config.utxoCache) {
        utxoProvider = fileSystemStorage(config.utxoCache);
    }
    let commProvider;
    if (config.commitmentEventsCache) {
        commProvider = fileSystemStorage(config.commitmentEventsCache);
    }
    const utxoStorage = initStorage(config, utxoProvider);
    const commStorage = initStorage(config, commProvider);
    return {
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
        async findUtxos({ pool = config.pool, keypair, tokens, excludeSpent = true, excludeOthers = true, from = config.startBlock }) {
            const chainId = BigInt(config.chainId);
            const spenderAddress = await keypair.address();
            const commKey = CommitmentEventsKey;
            // Populate Commitment Events cache with data stored on disk.
            const commCache = commStorage.get({
                namespace: coreNamespace,
                key: commKey,
                deserializer: commitmentEventDeserializer
            }) || {
                block: 0n,
                events: []
            };
            // Populate UTXO cache with data stored on disk.
            const utxoCache = utxoStorage.get({
                namespace: utxoNamespace,
                key: spenderAddress,
                deserializer: utxoDeserializer
            }) || {
                block: 0n,
                utxos: {}
            };
            // To keep the Commitment Events and UTXO cache in sync we always need to
            // scan from the block height that's stored in our Commitment Events cache.
            // If the cache wasn't populated yet, then we default to the passed-in
            // `from` value.
            let fromBlock = commCache.block !== 0n ? commCache.block : from;
            const toBlock = await config.provider.getBlockNumber().then(BigInt);
            const filter = pool.filters.NewCommitment();
            const events = await queryFilterBatched(fromBlock, toBlock, pool, filter);
            const newEvents = events.map(event => ({
                commitment: event.args.commitment,
                index: event.args.index,
                encryptedOutput: event.args.encryptedOutput
            }));
            // Merge cached events with new events.
            commCache.block = toBlock;
            commCache.events = mergeCommitmentEvents(commCache.events, newEvents);
            // Persist Commit Events cache to disk.
            commStorage.set({
                namespace: coreNamespace,
                key: commKey,
                value: commCache,
                serializer: commitmentEventSerializer
            });
            const allNewUtxos = await Promise.all(commCache.events.map(async (event) => {
                let utxo;
                try {
                    const result = await Utxo.decrypt(keypair, event.encryptedOutput, BigInt(event.index), chainId);
                    utxo = result.utxo;
                }
                catch (_) { } // eslint-disable-line no-empty
                if (!utxo) {
                    return null;
                }
                else {
                    if (utxo.amount.toString() === '0') {
                        return null;
                    }
                    const utxoToken = hex(utxo.token).toLowerCase();
                    if (excludeOthers && !utxo.keypair.privkey) {
                        return null;
                    }
                    if (excludeSpent) {
                        const nullifier = await utxo.getNullifier().then(n => hex(n, 32));
                        const isSpent = await pool.isSpent(nullifier);
                        if (isSpent) {
                            return null;
                        }
                    }
                    return [utxoToken, utxo];
                }
            }))
                // filtering out nulls
                .then((sparse) => sparse.filter(Boolean))
                // mapping from a flat 2d [k:token,v:utxo][] array to an object
                .then((flat) => {
                return flat.reduce((acc, [utxoToken, utxo]) => {
                    if (Array.isArray(acc[utxoToken])) {
                        acc[utxoToken].push(utxo);
                    }
                    else {
                        acc[utxoToken] = [utxo];
                    }
                    return acc;
                }, {});
            });
            const newUtxos = {};
            if (tokens) {
                for (const token of tokens) {
                    const tokenLower = token.toLowerCase();
                    if (allNewUtxos[tokenLower]) {
                        newUtxos[tokenLower] = allNewUtxos[tokenLower];
                    }
                }
            }
            else {
                Object.assign(newUtxos, allNewUtxos);
            }
            let cachedUtxos = {};
            // If requested, filter out spent UTXOs.
            if (excludeSpent) {
                for (const [address, utxos] of Object.entries(utxoCache.utxos)) {
                    const unspentUtxos = [];
                    for (const utxo of utxos) {
                        const nullifier = await utxo.getNullifier().then(n => hex(n, 32));
                        const isSpent = await pool.isSpent(nullifier);
                        if (!isSpent) {
                            unspentUtxos.push(utxo);
                        }
                    }
                    cachedUtxos[address] = unspentUtxos;
                }
            }
            else {
                cachedUtxos = { ...utxoCache.utxos };
            }
            // Merge cached UTXOs with new UTXOs.
            const utxos = mergeFindUtxosResults(cachedUtxos, allNewUtxos);
            // Update UTXO cache with block number and UTXOs.
            utxoCache.block = toBlock;
            utxoCache.utxos = utxos;
            // Persist cache to disk.
            utxoStorage.set({
                namespace: utxoNamespace,
                key: spenderAddress,
                value: utxoCache,
                serializer: utxoSerializer
            });
            const mergedUtxos = mergeFindUtxosResults(cachedUtxos, newUtxos);
            if (tokens) {
                const resultUtxos = {};
                for (const token of tokens) {
                    const tokenLower = token.toLowerCase();
                    if (mergedUtxos[tokenLower]) {
                        resultUtxos[tokenLower] = mergedUtxos[tokenLower];
                    }
                }
                return resultUtxos;
            }
            else {
                return mergedUtxos;
            }
        },
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
        async findFlaggedUtxos({ pool = config.pool, keypair, excludeSpent = true, excludeOthers = true, from = config.startBlock, token, excludeUtxos }) {
            //VERY IMPORTANT toLowerCase()
            token = token.toLowerCase();
            const utxos = await this.findUtxos({
                pool,
                keypair,
                excludeSpent,
                excludeOthers,
                from,
                tokens: [token]
            }).then(utxos => utxos[token]);
            const excludeSet = new Set(excludeUtxos ?? []);
            const filtered = utxos.filter(utxo => !excludeSet.has(utxo));
            if (filtered.length === 0) {
                throw new Error('No utxos found.');
            }
            const result = await fetchComplianceBlackList(config.complianceManager);
            const blacklistedIds = new Set();
            for (const id of result.blacklist) {
                blacklistedIds.add(BigInt(id));
            }
            const flaggedUtxos = new Set();
            for (const utxo of filtered) {
                for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                    const amount = utxo.subDepositAmounts[i];
                    if (amount === 0n)
                        continue;
                    const id = utxo.subDepositIds[i];
                    if (blacklistedIds.has(id)) {
                        flaggedUtxos.add(utxo);
                    }
                }
            }
            return {
                utxos: Array.from(flaggedUtxos)
            };
        },
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
        async findUtxosUpTo({ pool = config.pool, keypair, excludeSpent = true, excludeOthers = true, from = config.startBlock, token, amount, results = 16, excludeUtxos, targetCompliant = true }) {
            //VERY IMPORTANT toLowerCase()
            token = token.toLowerCase();
            const maxUtxos = await this.findUtxos({
                pool,
                keypair,
                excludeSpent,
                excludeOthers,
                from,
                tokens: [token]
            }).then(utxos => sortDescByAmount(utxos[token]).slice(0, 16));
            const excludeSet = new Set(excludeUtxos ?? []);
            const candidates = maxUtxos.filter(u => !excludeSet.has(u));
            if (candidates.length === 0) {
                throw new Error(`cannot cover amount with candidate utxos.`);
            }
            const initialSum = candidates.slice(0, results).reduce((sum, utxo) => sum + utxo.amount, 0n);
            const utxos = initialSum < amount ? candidates : candidates.slice(0, results);
            let accu = 0n;
            let pickedUtxos = null;
            for (let i = 0; i < utxos.length; i++) {
                accu += utxos[i].amount;
                if (accu >= amount) {
                    pickedUtxos = utxos.slice(0, i + 1);
                    break;
                }
            }
            if (pickedUtxos === null) {
                throw new Error(`insufficient UTXOs`);
            }
            let depositIds = new Set();
            const amountById = new Map();
            for (const utxo of pickedUtxos) {
                for (let i = 0; i < STX_DEPOSIT_COMPONENTS; i++) {
                    const amount = utxo.subDepositAmounts[i];
                    if (amount === 0n)
                        continue;
                    const id = utxo.subDepositIds[i];
                    depositIds.add(id);
                    const existing = amountById.get(id);
                    if (existing === undefined) {
                        amountById.set(id, utxo.subDepositAmounts[i]);
                    }
                    else {
                        amountById.set(id, existing + utxo.subDepositAmounts[i]);
                    }
                }
            }
            const depositIdsArray = [...depositIds].map(id => id.toString()).sort();
            const result = await fetchComplianceBlackList(config.complianceManager);
            const compliantIds = depositIdsArray.filter(id => !result.blacklist.includes(id));
            const uncompliantIds = depositIdsArray.filter(id => result.blacklist.includes(id));
            if (targetCompliant) {
                if (uncompliantIds.length === 0) {
                    return { utxos: pickedUtxos };
                }
                const totalSum = [...depositIds].reduce((sum, id) => sum + (amountById.get(id) ?? 0n), 0n);
                const uncompliantSum = uncompliantIds.reduce((sum, id) => sum + (amountById.get(BigInt(id)) ?? 0n), 0n);
                // if we can cover the `amount` after taking out the uncompliant depositIds amount, no need to change the picked utxo set
                // just return the `uncompliantDepositIds` and `uncompliantAmounts` to add to output utxo (on withdraw)
                if (totalSum - uncompliantSum >= amount) {
                    return {
                        utxos: pickedUtxos,
                        uncompliantDepositIds: uncompliantIds.map(id => BigInt(id)),
                        uncompliantAmounts: uncompliantIds.map(id => amountById.get(BigInt(id)) ?? 0n)
                    };
                }
                const utxosWithUncompliant = pickedUtxos.filter(utxo => utxo.subDepositIds.some(id => uncompliantIds.includes(id.toString())));
                return this.findUtxosUpTo({
                    pool,
                    keypair,
                    excludeSpent,
                    excludeOthers,
                    from,
                    token,
                    amount,
                    results,
                    targetCompliant,
                    excludeUtxos: [...(excludeUtxos ?? []), ...utxosWithUncompliant]
                });
            }
            else {
                if (compliantIds.length === 0) {
                    return { utxos: pickedUtxos };
                }
                const uncompliantSum = uncompliantIds.reduce((sum, id) => sum + (amountById.get(BigInt(id)) ?? 0n), 0n);
                if (uncompliantSum >= amount) {
                    return {
                        utxos: pickedUtxos,
                        uncompliantDepositIds: uncompliantIds.map(id => BigInt(id)),
                        uncompliantAmounts: uncompliantIds.map(id => amountById.get(BigInt(id)) ?? 0n),
                        compliantDepositIds: compliantIds.map(id => BigInt(id)),
                        compliantAmounts: compliantIds.map(id => amountById.get(BigInt(id)) ?? 0n)
                    };
                }
                // if we can't cover the `amount` after taking out the uncompliant/compliant based on target compliant depositIds amount, exclude the problematic utxo and try finding utxos again
                const utxosWithCompliant = pickedUtxos.filter(utxo => utxo.subDepositIds.some(id => compliantIds.includes(id.toString())));
                return this.findUtxosUpTo({
                    pool,
                    keypair,
                    excludeSpent,
                    excludeOthers,
                    from,
                    token,
                    amount,
                    results,
                    targetCompliant,
                    excludeUtxos: [...(excludeUtxos ?? []), ...utxosWithCompliant]
                });
            }
        }
    };
}
//# sourceMappingURL=find-utxos.js.map