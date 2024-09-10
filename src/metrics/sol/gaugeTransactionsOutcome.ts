import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'sol_rotation_tx_reverted';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'If a solana rotation tx has reverted on-chain',
    registers: [],
    labelNames: ['txHash'],
});

let lastRotationTx = '';
let deleted = false;

export const gaugeTxOutcome = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_tx_outcome')) {
        return;
    }
    const { logger, registry, connection, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);
    try {
        if (global.solanaRotationTx) {
            lastRotationTx = global.solanaRotationTx;
            const txResult = await connection.getTransaction(global.solanaRotationTx);
            if (txResult !== null) {
                // tx reverted:
                if (txResult.meta.err !== null) {
                    metric.labels(lastRotationTx).set(1);
                }
            }
        } else {
            if (lastRotationTx && !deleted) {
                setTimeout(() => {
                    metric.remove(lastRotationTx);
                    lastRotationTx = '';
                    deleted = false;
                }, 60000); // 60s
                deleted = true;
            }
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
