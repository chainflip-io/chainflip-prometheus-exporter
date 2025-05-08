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

export const gaugeFeeDeficit = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_fee_deficit')) {
        return;
    }
    const { logger, registry } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    // ETH fees balance
    const eth_fees = data.data.fee_imbalance.ethereum;
    if (Object.hasOwn(eth_fees, 'Deficit')) {
        // Deficit case
        const metricValue = -(Number(eth_fees.Deficit) / 1e18);
        metric.labels('ethereum').set(metricValue);
    } else {
        // Surplus case
        const metricValue = Number(eth_fees.Surplus) / 1e18;
        metric.labels('ethereum').set(metricValue);
    }

    // ARB fees balance
    const arb_fees = data.data.fee_imbalance.arbitrum;
    if (Object.hasOwn(arb_fees, 'Deficit')) {
        // Deficit case
        const metricValue = -(Number(arb_fees.Deficit) / 1e18);
        metric.labels('arbitrum').set(metricValue);
    } else {
        // Surplus case
        const metricValue = Number(arb_fees.Surplus) / 1e18;
        metric.labels('arbitrum').set(metricValue);
    }

    // DOT fees balance
    const dot_fees = data.data.fee_imbalance.polkadot;
    if (Object.hasOwn(dot_fees, 'Deficit')) {
        // Deficit case
        const metricValue = -(Number(dot_fees.Deficit) / 1e10);
        metric.labels('polkadot').set(metricValue);
    } else {
        // Surplus case
        const metricValue = Number(dot_fees.Surplus) / 1e10;
        metric.labels('polkadot').set(metricValue);
    }

    // SOL fees balance
    const sol_fees = data.data.fee_imbalance.solana;
    if (Object.hasOwn(sol_fees, 'Deficit')) {
        // Deficit case
        const metricValue = -(Number(sol_fees.Deficit) / 1e9);
        metric.labels('solana').set(metricValue);
    } else {
        // Surplus case
        const metricValue = Number(sol_fees.Surplus) / 1e9;
        metric.labels('solana').set(metricValue);
    }
};
