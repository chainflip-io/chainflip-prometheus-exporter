import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_flip_total_supply';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The total number of flip issued',
    registers: [],
});

export const gaugeFlipTotalSupply = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_flip_total_supply')) {
        return;
    }
    const { logger, registry } = context;

    logger.debug(`Scraping ${metricName}`);
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    const totalSupply: bigint = context.data.flip_supply.total_supply;
    const metricValue: number = Number(Number(totalSupply) / 10 ** 18);
    metric.set(metricValue);
};
