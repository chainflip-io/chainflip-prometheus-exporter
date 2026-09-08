import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { blockHeightStore } from '../../lib/blockHeightStore';

const metricName: string = 'bsc_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'BSC network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes(metricName)) {
        return;
    }
    const { logger, registry, httpProvider, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    try {
        const blockNumber = Number(await httpProvider.getBlockNumber());
        metric.set(blockNumber);
        blockHeightStore.setExternal('bsc', blockNumber);
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.error(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
