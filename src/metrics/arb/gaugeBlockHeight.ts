import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'arb_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Arbitrum network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('arb_block_height')) {
        return;
    }
    const { logger, registry, httpProvider } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    try {
        const blockNumber = await httpProvider.getBlockNumber();
        metric.set(Number(blockNumber));
    } catch (e) {
        logger.error(e);
    }
};
