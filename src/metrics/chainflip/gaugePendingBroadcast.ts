import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_pending_broadcast';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Number of broadcasts currently being processed',
    labelNames: ['broadcaster'],
    registers: [],
});

export const gaugePendingBroadcast = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_pending_broadcast')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        // Polkadot
        metric.labels('polkadot').set(context.data.pending_broadcasts.polkadot);

        // Bitcoin
        metric.labels('bitcoin').set(context.data.pending_broadcasts.bitcoin);

        // Ethereum
        metric.labels('ethereum').set(context.data.pending_broadcasts.ethereum);

        // Arbitrum
        metric.labels('arbitrum').set(context.data.pending_broadcasts.arbitrum);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
