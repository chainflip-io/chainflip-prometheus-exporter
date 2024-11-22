import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_swapping_queue';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Size of the swapping queue',
    registers: [],
});

export const gaugeSwappingQueue = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_swapping_queue')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metric.set(data.data.pending_swaps);
};
