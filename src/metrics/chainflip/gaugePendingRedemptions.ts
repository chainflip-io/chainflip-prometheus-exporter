import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricNamePendingRedemption: string = 'cf_pending_redemptions';
const metricPendingRedemption: Gauge = new promClient.Gauge({
    name: metricNamePendingRedemption,
    help: 'The number of pending redemptions registered on the state-chain.',
    registers: [],
});

const metricNamePendingRedemptionBalance: string = 'cf_pending_redemptions_balance';
const metricPendingRedemptionBalance: Gauge = new promClient.Gauge({
    name: metricNamePendingRedemptionBalance,
    help: 'The total balance of flip across all the redemptions currently pending',
    registers: [],
});

export const gaugePendingRedemptions = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    if (registry.getSingleMetric(metricNamePendingRedemption) === undefined)
        registry.registerMetric(metricPendingRedemption);
    if (registry.getSingleMetric(metricNamePendingRedemptionBalance) === undefined)
        registry.registerMetric(metricPendingRedemptionBalance);

    metricFailure.labels({ metric: metricNamePendingRedemption }).set(0);
    metricFailure.labels({ metric: metricNamePendingRedemptionBalance }).set(0);

    logger.debug(`Scraping ${metricNamePendingRedemption}, ${metricNamePendingRedemptionBalance}`);
    try {
        const pendingRedemptions = await api.query.funding.pendingRedemptions.entries();
        let totalRedemptionBalance: number = 0;
        pendingRedemptions.forEach(([key, element]: [any, any]) => {
            totalRedemptionBalance += parseFloat(element.toHuman()[0].replace(/,/g, '')) / 1e18;
        });

        metricPendingRedemptionBalance.set(totalRedemptionBalance);
        metricPendingRedemption.set(pendingRedemptions.length);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNamePendingRedemption }).set(1);
        metricFailure.labels({ metric: metricNamePendingRedemptionBalance }).set(1);
    }
};
