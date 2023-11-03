import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "dot_block_time";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Polkadot block time in ms",
  registers: [],
});

let previous: number = 0;

export const gaugeBlockTime = async (context: Context) => {
  const { logger, registry, api, metricFailure } = context;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const timestamp: number = await api.query.timestamp.now();
    if (previous === 0) {
      previous = Number(timestamp);
    } else {
      const metricValue = Number(timestamp) - previous;
      metric.set(metricValue);
      previous = Number(timestamp);
    }
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
