import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricNameRequestRetryQueue: string = 'cf_tss_request_retry_queue';
const metricRequestRetryQueue: Gauge = new promClient.Gauge({
    name: metricNameRequestRetryQueue,
    help: 'Size of the TSS request retry queue, it contains an entry for every request of TSS we receive if it gets rescheduled',
    labelNames: ['tss'],
    registers: [],
});

const metricNameCeremonyRetryQueue: string = 'cf_tss_ceremony_retry_queue';
const metricPendingCeremonyRetryQueue: Gauge = new promClient.Gauge({
    name: metricNameCeremonyRetryQueue,
    help: 'Size of the TSS retry queue, it contains an entry for every ceremony with a block at which it should be retried',
    labelNames: ['tss'],
    registers: [],
});

export const gaugeTssRetryQueues = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricNameRequestRetryQueue}, ${metricNameCeremonyRetryQueue}`);

    if (registry.getSingleMetric(metricNameRequestRetryQueue) === undefined)
        registry.registerMetric(metricRequestRetryQueue);
    if (registry.getSingleMetric(metricNameCeremonyRetryQueue) === undefined)
        registry.registerMetric(metricPendingCeremonyRetryQueue);
    metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(0);
    metricFailure.labels({ metric: metricNameCeremonyRetryQueue }).set(0);

    try {
        // requestRetryQueue
        const dotRequestRetryQueue: any =
            await api.query.polkadotThresholdSigner.requestRetryQueue.entries();
        let dotRequestRetryQueueLength: number = 0;
        dotRequestRetryQueue.forEach(([key, element]: [any, any]) => {
            dotRequestRetryQueueLength += Number(element.toHuman().length);
        });
        metricRequestRetryQueue.labels('polkadot').set(dotRequestRetryQueueLength);

        const btcRequestRetryQueue: any =
            await api.query.bitcoinThresholdSigner.requestRetryQueue.entries();
        let btcRequestRetryQueueLength: number = 0;
        btcRequestRetryQueue.forEach(([key, element]: [any, any]) => {
            btcRequestRetryQueueLength += Number(element.toHuman().length);
        });
        metricRequestRetryQueue.labels('bitcoin').set(btcRequestRetryQueueLength);

        const ethRequestRetryQueue: any =
            await api.query.evmThresholdSigner.requestRetryQueue.entries();
        let ethRequestRetryQueueLength: number = 0;
        ethRequestRetryQueue.forEach(([key, element]: [any, any]) => {
            ethRequestRetryQueueLength += Number(element.toHuman().length);
        });
        metricRequestRetryQueue.labels('evm').set(ethRequestRetryQueueLength);

        // ceremonyRetryQueues
        const dotCeremonyRetryQueue: any =
            await api.query.polkadotThresholdSigner.ceremonyRetryQueues.entries();
        let dotCeremonyRetryQueueLength: number = 0;
        dotCeremonyRetryQueue.forEach(([key, element]: [any, any]) => {
            dotCeremonyRetryQueueLength += Number(element.toHuman().length);
        });
        metricPendingCeremonyRetryQueue.labels('polkadot').set(dotCeremonyRetryQueueLength);

        const btcCeremonyRetryQueue: any =
            await api.query.bitcoinThresholdSigner.ceremonyRetryQueues.entries();
        let btcCeremonyRetryQueueLength: number = 0;
        btcCeremonyRetryQueue.forEach(([key, element]: [any, any]) => {
            btcCeremonyRetryQueueLength += Number(element.toHuman().length);
        });
        metricPendingCeremonyRetryQueue.labels('bitcoin').set(btcCeremonyRetryQueueLength);

        const ethCeremonyRetryQueue: any =
            await api.query.evmThresholdSigner.ceremonyRetryQueues.entries();
        let ethCeremonyRetryQueueLength: number = 0;
        ethCeremonyRetryQueue.forEach(([key, element]: [any, any]) => {
            ethCeremonyRetryQueueLength += Number(element.toHuman().length);
        });
        metricPendingCeremonyRetryQueue.labels('evm').set(ethCeremonyRetryQueueLength);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(1);
        metricFailure.labels({ metric: metricNameCeremonyRetryQueue }).set(1);
    }
};
