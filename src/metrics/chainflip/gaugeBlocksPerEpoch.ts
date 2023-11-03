import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_block_per_epoch";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Number of blocks between each epoch",
  registers: [],
});

export const gaugeBlocksPerEpoch = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  let blocksPerEpoch: any;
  try {
    blocksPerEpoch = await api.query.validator.blocksPerEpoch();
    metric.set(blocksPerEpoch.toJSON());
  } catch (e) {
    logger.error(e);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
