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
    const { logger, api, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);
    metricFailure.labels({ metric: metricName }).set(0);
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    try {
        // ETH fees balance
        const feeWitheldEth = Number(
            (await api.query.ethereumIngressEgress.withheldTransactionFees('Eth'))
                .toHuman()
                .replace(/,/g, ''),
        );
        const feeSpentEth = await api.query.ethereumBroadcaster.transactionFeeDeficit.entries();
        let totalSpent = 0;
        feeSpentEth.forEach(([key, element]: [any, any]) => {
            totalSpent += Number(element.toHuman().replace(/,/g, ''));
        });
        const deficitEth = (feeWitheldEth - totalSpent) / 1e18;
        metric.labels('ethereum').set(deficitEth);

        // DOT fees balance
        const feeWitheldDot = Number(
            (await api.query.polkadotIngressEgress.withheldTransactionFees('Dot'))
                .toHuman()
                .replace(/,/g, ''),
        );
        const feeSpentDot = await api.query.polkadotBroadcaster.transactionFeeDeficit.entries();
        totalSpent = 0;
        feeSpentDot.forEach(([key, element]: [any, any]) => {
            totalSpent += Number(element.toHuman().replace(/,/g, ''));
        });
        const deficitDot = (feeWitheldDot - totalSpent) / 1e10;
        metric.labels('polkadot').set(deficitDot);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
