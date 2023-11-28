import promClient, {Gauge} from "prom-client";
import {Context} from "../../lib/interfaces";

const metricName: string = "cf_pending_redemptions"
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: "Pending redemptions registered on the state-chain.",
    registers: [],
});

export const gaugePendingRedemptions = async (context: Context): Promise<void> => {
    const {logger, api, registry, metricFailure} = context;

    if (registry.getSingleMetric(metricName) === undefined)
        registry.registerMetric(metric);

    metricFailure.labels({metric: metricName}).set(0);

    logger.debug(`Scraping ${metricName}`);
    try {
        const pendingRedemptions = await api.query.funding.pendingRedemptions.entries();
        metric.set(pendingRedemptions.length);
    } catch (e) {
        logger.error(e);
    }
};
