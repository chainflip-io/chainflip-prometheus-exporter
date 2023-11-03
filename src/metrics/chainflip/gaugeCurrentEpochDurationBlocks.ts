import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_current_epoch_duration_blocks";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "How long has the current epoch lasted",
  registers: [],
});

export const gaugeCurrentEpochDurationBlocks = async (
  context: Context
): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const currentEpochStartedAt: number =
      await api.query.validator.currentEpochStartedAt();
    const currentBlockHeight: number = await api.query.system.number();

    const currentEpochDurationBlocks: number =
      currentBlockHeight - currentEpochStartedAt;
    metric.set(currentEpochDurationBlocks);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
