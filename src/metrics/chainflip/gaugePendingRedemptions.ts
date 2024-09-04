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
    if (context.config.skipMetrics.includes('cf_pending_redemptions')) {
        return;
    }
    const { logger, registry } = context;

    if (registry.getSingleMetric(metricNamePendingRedemption) === undefined)
        registry.registerMetric(metricPendingRedemption);
    if (registry.getSingleMetric(metricNamePendingRedemptionBalance) === undefined)
        registry.registerMetric(metricPendingRedemptionBalance);

    logger.debug(`Scraping ${metricNamePendingRedemption}, ${metricNamePendingRedemptionBalance}`);

    const pendingRedemptions = context.data.pending_redemptions.count;
    const totalRedemptionBalance: number =
        Number(context.data.pending_redemptions.total_balance) / 1e18;

    metricPendingRedemptionBalance.set(totalRedemptionBalance);
    metricPendingRedemption.set(pendingRedemptions);
};
