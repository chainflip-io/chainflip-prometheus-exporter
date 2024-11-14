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
let subscriptionId: number;

export const startSubscription = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_subscriptions')) {
        return;
    }
    if (lastOnChainKey === global.solanaCurrentOnChainKey || !global.solanaCurrentOnChainKey) {
        return;
    }
    lastOnChainKey = global.solanaCurrentOnChainKey;
    const { logger, registry, connection, metricFailure, config } = context;
    if (subscriptionId !== undefined) {
        await connection.removeOnLogsListener(subscriptionId);
    }
    logger.debug(`Scraping ${metricSolanaTxRevertedName}`);

    if (registry.getSingleMetric(metricSolanaTxRevertedName) === undefined)
        registry.registerMetric(metricSolanaTxReverted);

    metricFailure.labels({ metric: metricSolanaTxRevertedName }).set(0);

    try {
        subscriptionId = connection.onLogs(
            new PublicKey(global.solanaCurrentOnChainKey),
            async (log: any) => {
                if (log.err !== null) {
                    const transaction = await context.connection.getTransaction(log.signature, {
                        commitment: 'finalized',
                    });
                    const keys = transaction.transaction.message.accountKeys;
                    // only report reverted tx if they are originated from our aggKey
                    if (keys[0].toString() === global.solanaCurrentOnChainKey) {
                        metricSolanaTxReverted.labels(log.signature).set(1);
                        setTimeout(() => {
                            metricSolanaTxReverted.remove(log.signature);
                        }, 600000); // 10m
                    }
                }
            },
            'finalized',
        );
    } catch (err) {
        logger.error(err);
        if (subscriptionId !== undefined) {
            await connection.removeOnLogsListener(subscriptionId);
        }
        metricFailure.labels({ metric: metricSolanaTxRevertedName }).set(1);
    }
};
