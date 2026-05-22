import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blockHeightStore } from '../../lib/blockHeightStore';

const metricName: string = 'tron_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Tron network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('tron_block_height')) {
        return;
    }
    const { logger, registry, httpProvider } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    try {
        const block = await httpProvider.trx.getCurrentBlock();
        const blockNumber = Number(block.block_header.raw_data.number);
        metric.set(blockNumber);
        blockHeightStore.setExternal('tron', blockNumber);
    } catch (e) {
        logger.error(e);
    }
};
