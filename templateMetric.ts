// This is a sample of how we structure a new metric. Use this to get started when adding any new metrics.

import promClient, {Gauge} from "prom-client";

const metricName: string = "";
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: "",
    registers: [],
});

export const _ = async (context: Context): Promise<void> => {
    const {logger, api, registry, metricFailure} = context;

    if (registry.getSingleMetric(metricName) === undefined)
        registry.registerMetric(metric);

    metricFailure.labels({metric: metricName}).set(0);

    logger.debug(`Scraping ${metricName}`);
    try {
    } catch (e) {
        logger.error(e);
    }
};
