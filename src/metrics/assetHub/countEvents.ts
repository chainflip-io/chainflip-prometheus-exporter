import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'hub_events_count_total';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Count of events on chain',
    labelNames: ['event'],
    registers: [],
});

export const countEvents = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('hub_events_count_total')) {
        return;
    }
    const { logger, registry, header, api, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('system:CodeUpdated').set(0);
    }

    try {
        const blockHash = await api.rpc.chain.getBlockHash(header.toJSON().number);
        const apiAt = await api.at(blockHash);
        const events = await apiAt.query.system.events();

        for (const { event } of events) {
            metric.labels(`${event.section}:${event.method}`).inc();
        }
        metricFailure.labels('hub_events_count_total').set(0);
    } catch (e) {
        logger.error(`catch ${e}`);
        metricFailure.labels('hub_events_count_total').set(1);
    }
};
