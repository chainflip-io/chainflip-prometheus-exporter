import promClient, {Gauge} from "prom-client";
import {Context} from "../../lib/interfaces";

const metricPendingRedemptionName: string = "cf_pending_redemptions"
const metricPendingRedemption: Gauge = new promClient.Gauge({
    name: metricPendingRedemptionName,
    help: "Pending redemptions registered on the state-chain.",
    registers: [],
});

const metricPendingRedemptionBalanceName: string = "cf_pending_redemptions_balance"
const metricPendingRedemptionBalance: Gauge = new promClient.Gauge({
    name: metricPendingRedemptionBalanceName,
    help: "The total balance of flip across all the redemption currently pending",
    registers: [],
});

export const gaugePendingRedemptions = async (context: Context): Promise<void> => {
    const {logger, api, registry, metricFailure} = context;

    if (registry.getSingleMetric(metricPendingRedemptionName) === undefined)
        registry.registerMetric(metricPendingRedemption);
    if (registry.getSingleMetric(metricPendingRedemptionBalanceName) === undefined)
        registry.registerMetric(metricPendingRedemptionBalance);

    metricFailure.labels({metric: metricPendingRedemptionName}).set(0);
    metricFailure.labels({metric: metricPendingRedemptionBalanceName}).set(0);


    logger.debug(`Scraping ${metricPendingRedemptionName}, ${metricPendingRedemptionBalanceName}`);
    try {
        const pendingRedemptions = await api.query.funding.pendingRedemptions.entries();
        let totalRedemptionBalance: number = 0;
        pendingRedemptions.forEach(([key , element]: [any, any]) => {
            totalRedemptionBalance += (parseFloat(element.toHuman()[0].replace(/,/g, '')) / 1e18);
        });

        metricPendingRedemptionBalance.set(totalRedemptionBalance);
        metricPendingRedemption.set(pendingRedemptions.length);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({metric: metricPendingRedemptionName}).set(1);
        metricFailure.labels({metric: metricPendingRedemptionBalanceName}).set(1);
    }
};
