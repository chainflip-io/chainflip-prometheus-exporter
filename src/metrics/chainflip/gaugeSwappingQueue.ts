import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_swapping_queue";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Size of the swapping queue",
  registers: [],
});

export const gaugeSwappingQueue = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const swapQueue: any[] = await api.query.swapping.swapQueue();
    const swapQueueLenght: number = swapQueue.length;
    metric.set(swapQueueLenght);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
