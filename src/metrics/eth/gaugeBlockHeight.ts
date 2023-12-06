import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'eth_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Ethereum network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    const { logger, registry, blockNumber } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metric.set(Number(blockNumber));
};
