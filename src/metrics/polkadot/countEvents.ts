import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { DotConfig, FlipConfig } from '../../config/interfaces';
import { decodeAddress } from '@polkadot/util-crypto';

const metricName: string = 'dot_events_count_total';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Count of events on chain',
    labelNames: ['event'],
    registers: [],
});

export const countEvents = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('dot_events_count_total')) {
        return;
    }
    const { logger, registry, events, api } = context;
    const config = context.config as DotConfig;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('system:CodeUpdated').set(0);
    }

    for (const { event } of events) {
        metric.labels(`${event.section}:${event.method}`).inc();
    }
};
