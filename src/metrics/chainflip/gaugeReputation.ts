import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";
import { FlipConfig } from "../../config/interfaces";

const metricName: string = "cf_reputation";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "The reputation of a validator",
  labelNames: ["ss58", "alias"],
  registers: [],
});

export const gaugeReputation = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);
  const config = context.config as FlipConfig;
  const { accounts } = config;


  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);

  metricFailure.labels({ metric: metricName }).set(0);

  try {
    for (const { ss58Address, alias } of accounts) {
        const reputation = await api.query.reputation.reputations(ss58Address);
        metric.labels(ss58Address, alias).set(Number(reputation.reputationPoints))
    }
  } catch (e) {
    logger.error(e);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
