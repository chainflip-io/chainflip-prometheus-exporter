import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'hub_events_count_total';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Count of events on chain',
    labelNames: ['event'],
    registers: [],
});

// Last observed runtime spec version.
let lastSpecVersion: number | undefined;

export const countEvents = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('hub_events_count_total')) {
        return;
    }
    const { logger, registry, api, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) {
        registry.registerMetric(metric);
        metric.labels('system:CodeUpdated').set(0);
    }

    try {
        const lastRuntimeUpgrade = (await api.query.system.lastRuntimeUpgrade()).toJSON() as {
            specVersion: number;
            specName: string;
        } | null;
        const specVersion = lastRuntimeUpgrade?.specVersion;

        if (specVersion !== undefined) {
            if (lastSpecVersion !== undefined && specVersion !== lastSpecVersion) {
                logger.info(
                    `AssetHub runtime upgrade detected: specVersion ${lastSpecVersion} -> ${specVersion}`,
                );
                metric.labels('system:CodeUpdated').inc();
            }
            lastSpecVersion = specVersion;
        }
        metricFailure.labels('hub_events_count_total').set(0);
    } catch (e) {
        logger.error(`catch ${e}`);
        metricFailure.labels('hub_events_count_total').set(1);
    }
};
