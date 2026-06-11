import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNamePendingTss: string = 'cf_pending_tss';
const metricPendingTss: Gauge = new promClient.Gauge({
    name: metricNamePendingTss,
    help: 'Number of pending tss ceremonies',
    labelNames: ['tss'],
    registers: [],
});

export const gaugeTssRetryQueues = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_tss')) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    logger.debug('scraping', { metric: metricNamePendingTss, blockNumber: data.blockNumber });

    try {
        if (registry.getSingleMetric(metricNamePendingTss) === undefined)
            registry.registerMetric(metricPendingTss);

        // EVM
        metricPendingTss.labels('evm').set(data.data.pending_tss.evm);

        // Bitcoin
        metricPendingTss.labels('bitcoin').set(data.data.pending_tss.bitcoin);

        // Solana
        metricPendingTss.labels('solana').set(data.data.pending_tss.solana);

        metricFailure.labels({ metric: metricNamePendingTss }).set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNamePendingTss }).set(1);
    }
};
