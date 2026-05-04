import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blockHeightStore } from '../../lib/blockHeightStore';

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
        const blockNumber = await httpProvider.getBlockNumber();
        metric.set(Number(blockNumber));
        blockHeightStore.setExternal('ethereum', Number(blockNumber));
    } catch (e) {
        logger.error(e);
    }
};
