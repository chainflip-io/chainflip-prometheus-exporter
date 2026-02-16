import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { DotConfig } from '../../config/interfaces';

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
    const { logger, registry, header, api, metricFailure } = context;
    const config = context.config as DotConfig;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('system:CodeUpdated').set(0);
    }

    try {
        const events = await context.apiAt.query.system.events();

        for (const { event } of events) {
            metric.labels(`${event.section}:${event.method}`).inc();
        }
        metricFailure.labels('dot_events_count_total').set(0);
    } catch (e) {
        logger.error(`catch ${e}`);
        metricFailure.labels('dot_events_count_total').set(1);
    }
};
