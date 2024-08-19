import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricNamePendingTss: string = 'cf_pending_tss';
const metricPendingTss: Gauge = new promClient.Gauge({
    name: metricNamePendingTss,
    help: 'Number of pending tss ceremonies',
    labelNames: ['tss'],
    registers: [],
});

export const gaugeTssRetryQueues = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_tss')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricNamePendingTss}`);

    if (registry.getSingleMetric(metricNamePendingTss) === undefined)
        registry.registerMetric(metricPendingTss);
    metricFailure.labels({ metric: metricNamePendingTss }).set(0);

    try {
        // EVM
        metricPendingTss.labels('evm').set(context.data.pending_tss.evm);

        // Bitcoin
        metricPendingTss.labels('bitcoin').set(context.data.pending_tss.bitcoin);

        // Polkadot
        metricPendingTss.labels('polkadot').set(context.data.pending_tss.polkadot);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricNamePendingTss }).set(1);
    }
};
