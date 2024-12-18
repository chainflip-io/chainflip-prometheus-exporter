import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'eth_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Ethereum network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('eth_block_height')) {
        return;
    }
    const { logger, registry, httpProvider } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    try {
        const blockNumber = await httpProvider.send('eth_blockNumber');
        metric.set(Number(blockNumber));
    } catch (e) {
        logger.error(e);
    }
};
