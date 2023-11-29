import promClient from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "eth_block_time";
const metric = new promClient.Gauge({
  name: metricName,
  help: "Ethereum block time in ms",
  registers: [],
});

let previous: number = 0;

export const gaugeBlockTime = async (context: Context) => {

  const { logger, provider, registry, blockNumber, metricFailure } = context;
  try {
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined)
      registry.registerMetric(metric);

    const timestamp: number = (await provider.getBlock(blockNumber)).timestamp;
    if (previous === 0) {
      previous = Number(timestamp);
    } else {
      // we want it in ms
      const metricValue = (Number(timestamp) - previous) * 1000;
      metric.set(metricValue);
      previous = Number(timestamp);
    }
    metricFailure.labels({ metric: metricName }).set(0);
  } catch (error) {
    logger.error(error);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
