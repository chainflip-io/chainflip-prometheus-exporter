import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { PublicKey, NonceAccount } from '@solana/web3.js';

const metricSolanaTxRevertedName: string = 'sol_tx_reverted';
const metricSolanaTxReverted: Gauge = new promClient.Gauge({
    name: metricSolanaTxRevertedName,
    help: 'If a tx reverted on-chain',
    registers: [],
    labelNames: ['txHash'],
});

let lastOnChainKey = '';
let subscriptionId :number;

export const startSubscription = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_subscriptions')) {
        return;
    }
    if (lastOnChainKey === global.solanaCurrentOnChainKey || !global.solanaCurrentOnChainKey) {
        console.log("SUB ID: " + subscriptionId);
        return;
    }
    lastOnChainKey = global.solanaCurrentOnChainKey;
    console.log("QUA arriavmo");
    const { logger, registry, connection, metricFailure, config } = context;
    if (subscriptionId) {
        console.log("Removing sub : " + subscriptionId);
        await connection.removeOnLogsListener(subscriptionId);
    }
    logger.debug(`Scraping ${metricSolanaTxRevertedName}`);

    if (registry.getSingleMetric(metricSolanaTxRevertedName) === undefined)
        registry.registerMetric(metricSolanaTxReverted);

    metricFailure.labels({ metric: metricSolanaTxRevertedName }).set(0);

    try {
        console.log("STARTING SUBSCRIPTION");
        subscriptionId = connection.onLogs(new PublicKey(global.solanaCurrentOnChainKey), (log) => {
            console.log(log);
            if(log.err) {
                metricSolanaTxReverted.labels(log.signature).set(1);
                // TODO: set timeout and delete it after ~1h?? otherwise we'll remain with a firing alert the whole time
            }
        })
        console.log("ID: " + subscriptionId);
    } catch (err) {
        logger.error(err);
        if(subscriptionId) {
            await connection.removeOnLogsListener(subscriptionId);
        }
        metricFailure.labels({ metric: metricSolanaTxRevertedName }).set(1);
    }
};
