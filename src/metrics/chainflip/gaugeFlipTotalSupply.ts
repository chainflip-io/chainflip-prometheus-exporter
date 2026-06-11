import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_flip_total_supply';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The total number of flip issued',
    registers: [],
});

export const gaugeFlipTotalSupply = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_flip_total_supply')) {
        return;
    }
    const { logger, registry, metricFailure } = context;

    logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

    try {
        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        const totalSupply: bigint = data.data.flip_supply.total_supply;
        const metricValue: number = Number(Number(totalSupply) / 10 ** 18);
        metric.set(metricValue);
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
