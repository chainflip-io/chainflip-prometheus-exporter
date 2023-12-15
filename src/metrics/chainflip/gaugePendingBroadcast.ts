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
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        const dotQueue: any = await api.query.polkadotBroadcaster.pendingBroadcasts();
        const dotQueueLenght: number = dotQueue.size;
        metric.labels('polkadot').set(dotQueueLenght);

        const btcQueue: any = await api.query.bitcoinBroadcaster.pendingBroadcasts();
        const btcQueueLenght: number = btcQueue.size;
        metric.labels('bitcoin').set(btcQueueLenght);

        const ethQueue: any = await api.query.ethereumBroadcaster.pendingBroadcasts();
        const ethQueueLenght: number = ethQueue.size;
        metric.labels('ethereum').set(ethQueueLenght);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
