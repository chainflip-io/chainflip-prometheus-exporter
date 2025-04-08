import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { PublicKey, NonceAccount } from '@solana/web3.js';
import base58 from 'bs58';

const metricSolanaTxRevertedName: string = 'sol_tx_reverted';
const metricSolanaTxReverted: Gauge = new promClient.Gauge({
    name: metricSolanaTxRevertedName,
    help: 'If a tx reverted on-chain',
    registers: [],
    labelNames: ['txHash'],
});

const metricSolanaCCMTxRevertedName: string = 'sol_ccm_tx_reverted';
const metricSolanaCCMTxReverted: Gauge = new promClient.Gauge({
    name: metricSolanaCCMTxRevertedName,
    help: 'If a ccm tx reverted on-chain',
    registers: [],
    labelNames: ['txHash'],
});

let lastOnChainKey = '';
let subscriptionId: number;

// ExecuteCcmNative => 7d050be38042e0b2
// ExecuteCcmToken => 6cb8a27b9fdea223
const ccmInstructions = ['7d050be38042e0b2', '6cb8a27b9fdea223'];

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
    if (registry.getSingleMetric(metricSolanaCCMTxRevertedName) === undefined)
        registry.registerMetric(metricSolanaCCMTxReverted);

    metricFailure.labels({ metric: metricSolanaTxRevertedName }).set(0);

    try {
        subscriptionId = connection.onLogs(
            new PublicKey(global.solanaCurrentOnChainKey),
            async (log: any) => {
                if (log.err !== null) {
                    const transaction = await context.connection.getTransaction(log.signature, {
                        commitment: 'finalized',
                        maxSupportedTransactionVersion: 0,
                    });
                    const keys = transaction.transaction.message.accountKeys;
                    // only report reverted tx if they are originated from our aggKey
                    if (keys[0].toString() === global.solanaCurrentOnChainKey) {
                        if (transaction.transaction.message.instructions.length <= 4) {
                            // Transfer/fetch
                            metricSolanaTxReverted.labels(log.signature).set(1);
                            setTimeout(() => {
                                metricSolanaTxReverted.remove(log.signature);
                            }, 60000); // 1m
                        } else {
                            const instruction =
                                transaction.transaction.message.instructions[4].data;
                            const decoded_instruction = Buffer.from(
                                base58.decode(instruction).slice(0, 8),
                            ).toString('hex');
                            if (ccmInstructions.includes(decoded_instruction)) {
                                // CCM
                                metricSolanaCCMTxReverted.labels(log.signature).set(1);
                                setTimeout(() => {
                                    metricSolanaCCMTxReverted.remove(log.signature);
                                }, 60000); // 1m
                            } else {
                                // Rotation/Batched fetches
                                metricSolanaTxReverted.labels(log.signature).set(1);
                                setTimeout(() => {
                                    metricSolanaTxReverted.remove(log.signature);
                                }, 60000); // 1m
                            }
                        }
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
