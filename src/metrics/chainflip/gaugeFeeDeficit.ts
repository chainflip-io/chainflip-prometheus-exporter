import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_fee_deficit';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The fee deficit, (witheld fee - fee actually spent)',
    labelNames: ['tracked_chain'],
    registers: [],
});

export const gaugeFeeDeficit = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_fee_deficit')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);
    metricFailure.labels({ metric: metricName }).set(0);
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    try {
        // ETH fees balance
        const eth_fees = context.data.fee_imbalance.ethereum;
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
        const arb_fees = context.data.fee_imbalance.arbitrum;
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
        const dot_fees = context.data.fee_imbalance.polkadot;
        if (Object.hasOwn(dot_fees, 'Deficit')) {
            // Deficit case
            const metricValue = -(Number(dot_fees.Deficit) / 1e10);
            metric.labels('polkadot').set(metricValue);
        } else {
            // Surplus case
            const metricValue = Number(dot_fees.Deficit) / 1e10;
            metric.labels('polkadot').set(metricValue);
        }
        // BTC fees balance
        const btc_fees = context.data.fee_imbalance.bitcoin;
        if (Object.hasOwn(btc_fees, 'Deficit')) {
            // Deficit case
            const metricValue = -(Number(btc_fees.Deficit) / 1e8);
            metric.labels('bitcoin').set(metricValue);
        } else {
            // Surplus case
            const metricValue = Number(btc_fees.Deficit) / 1e8;
            metric.labels('bitcoin').set(metricValue);
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
