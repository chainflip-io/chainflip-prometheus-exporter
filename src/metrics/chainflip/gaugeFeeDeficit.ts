import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_fee_imbalance';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The fee imbalance, (witheld fee - fee actually spent)',
    labelNames: ['tracked_chain'],
    registers: [],
});

function feeImbalanceValue(
    imbalance: { Surplus: bigint } | { Deficit: bigint },
    decimals: number,
): number {
    if ('Deficit' in imbalance) {
        return -(Number(imbalance.Deficit) / decimals);
    }
    return Number(imbalance.Surplus) / decimals;
}

export const gaugeFeeDeficit = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_fee_deficit')) {
        return;
    }
    const { logger, registry } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metric.labels('ethereum').set(feeImbalanceValue(data.data.fee_imbalance.ethereum, 1e18));
    metric.labels('arbitrum').set(feeImbalanceValue(data.data.fee_imbalance.arbitrum, 1e18));
    metric.labels('assethub').set(feeImbalanceValue(data.data.fee_imbalance.assethub, 1e10));
    metric.labels('bitcoin').set(feeImbalanceValue(data.data.fee_imbalance.bitcoin, 1e8));
    metric.labels('solana').set(feeImbalanceValue(data.data.fee_imbalance.solana, 1e9));
};
