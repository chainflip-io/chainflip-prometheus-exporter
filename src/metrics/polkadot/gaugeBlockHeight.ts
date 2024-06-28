import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'dot_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Chainflip network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('dot_block_height')) {
        return;
    }
    const { logger, registry, header } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metric.set(Number(header.number));
};
