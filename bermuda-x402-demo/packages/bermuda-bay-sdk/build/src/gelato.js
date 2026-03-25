// @ts-nocheck
import { getAddress } from 'ethers';
import { progress } from './utils.js';
export default function init(config) {
    return {
        async relayRaw({ target, data, feeToken, gasLimit }) {
            progress('Dispatching transaction via Gelato Relay');
            const res = await callWithSyncFee({
                chainId: Number(config.chainId),
                target,
                data,
                feeToken,
                isRelayContext: true,
                gasLimit
            });
            progress('Awaiting transaction confirmation');
            const tx = await fetchGelatoRelayTx(res.taskId).catch(console.error);
            progress('');
            if (!tx) {
                throw new Error('Gelato Relay failure');
            }
            return tx;
        },
        async sponsoredCall(req) {
            progress('Dispatching transaction via Gelato Relay');
            const { taskId } = await fetch('https://api.gelato.digital/relays/v2/sponsored-call', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    chainId: req.chainId,
                    target: getAddress(req.target),
                    data: req.data,
                    sponsorApiKey: '_IjDuSN2kss6XnPaKTHneoBFUGrxhsq185U2Ax7q2vw_' //OOR
                })
            })
                .then(res => res.json())
                .catch(console.error);
            progress('Awaiting transaction confirmation');
            const tx = await fetchGelatoRelayTx(taskId).catch(console.error);
            if (!tx) {
                throw new Error('Gelato Relay failure');
            }
            return tx;
        },
        async relayFeeEstimate(feeToken, chainId = Number(config.chainId), transferNoteLength = 0) {
            const extraNoteGas = Math.ceil(transferNoteLength * 16 + (transferNoteLength / 32) * 9 + transferNoteLength ** 2);
            const estimatedFee = await this.getEstimatedFee({
                chainId,
                feeToken,
                gasLimit: BigInt(2300000 + extraNoteGas),
                isHighPriority: false
            });
            return estimatedFee;
        },
        async getEstimatedFee({ chainId, feeToken, gasLimit, isHighPriority, gasLimitL1 }) {
            return fetch(`https://api.gelato.digital/oracles/${chainId.toString()}/estimate?paymentToken=${getAddress(feeToken)}&gasLimit=${gasLimit}&isHighPriority=${isHighPriority}&gasLimitL1=${gasLimitL1}`)
                .then(res => res.json())
                .then(res => BigInt(res.estimatedFee));
        }
    };
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function gelatoTaskUrl(taskId) {
    return `https://relay.gelato.digital/tasks/status/${taskId}`;
}
function pollGelatoTask(taskId) {
    return fetch(gelatoTaskUrl(taskId))
        .then(res => res.json())
        .then(res => {
        if (res.task.taskState === 'ExecReverted' ||
            res.task.taskState === 'Blacklisted' ||
            res.task.taskState === 'Cancelled' ||
            res.task.taskState === 'NotFound') {
            throw Error(`Gelato task ${taskId} failed`);
        }
        if (res.task.taskState === 'ExecSuccess') {
            return res.task.transactionHash;
        }
    });
}
async function fetchGelatoRelayTx(taskId, timeout = 1000, tries = 90) {
    let tx = await pollGelatoTask(taskId);
    while (!tx && --tries) {
        await sleep(timeout);
        tx = await pollGelatoTask(taskId);
    }
    return tx;
}
// custom callWithSyncFee and getEstimatedFee to avoid snaps-incompatible axios
async function callWithSyncFee(req) {
    return fetch('https://api.gelato.digital/relays/v2/call-with-sync-fee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            chainId: req.chainId,
            target: getAddress(req.target),
            data: req.data,
            feeToken: getAddress(req.feeToken),
            isRelayContext: true,
            // gelato relay needs 150k operational gas
            gasLimit: req.gasLimit
                ? req.gasLimit /*+ 150_000*/
                    .toString()
                : undefined,
            retries: req.retries
        })
    }).then(res => res.json());
}
//# sourceMappingURL=gelato.js.map