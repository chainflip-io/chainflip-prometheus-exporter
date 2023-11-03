import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_suspended_validators_keygen_failed";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "The number of validators in a particular set that have been suspended due to failing keygen",
  registers: [],
});

export const gaugeSuspendedValidatorKeygenFailed = async (
  context: Context
): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const suspensionList: any = await api.query.reputation.suspensions(1);
    const metricValue: number = suspensionList.length;
    metric.set(metricValue);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
