import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";
import { DotConfig } from "../../config/interfaces";

const metricName: string = "dot_balance";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Polakdot balance in DOT",
  registers: [],
});

export const gaugeDotBalance = async (context: Context) => {
  const { logger, registry, api, metricFailure, config } = context;

  const { accounts } = config as DotConfig;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    for (const { alias, publicKey } of accounts) {
      const dotAccount: any = await api.query.system.account(publicKey);
      const metricValue = Number(dotAccount.data.free) / 10000000000;
      metric.set(metricValue);
    }
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
