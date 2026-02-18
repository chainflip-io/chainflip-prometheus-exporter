import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Chainflip network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context, data: ProtocolData) => {
    if (context.config.skipMetrics.includes('cf_block_height')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metric.set(data.blockNumber);
    registry.registerMetric(metric);
};
