import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_pending_broadcast';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of broadcasts currently being processed',
    labelNames: ['broadcaster'],
    registers: [],
});

export const gaugePendingBroadcast = async (
    context: Context,
    data: ProtocolData,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_pending_broadcast')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    // Assethub
    metric.labels('assethub').set(data.data.pending_broadcasts.assethub);

    // Bitcoin
    metric.labels('bitcoin').set(data.data.pending_broadcasts.bitcoin);

    // Ethereum
    metric.labels('ethereum').set(data.data.pending_broadcasts.ethereum);

    // Arbitrum
    metric.labels('arbitrum').set(data.data.pending_broadcasts.arbitrum);

    // Solana
    metric.labels('solana').set(data.data.pending_broadcasts.solana);
};
