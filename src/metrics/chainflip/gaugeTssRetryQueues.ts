import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_tss_retry_queue";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Size of the TSS retry queue",
  labelNames: ["broadcaster"],
  registers: [],
});

export const gaugeTssRetryQueues = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const dotQueue: any = await api.query.polkadotThresholdSigner.ceremonyRetryQueues(null);
    const dotQueueLenght: number = dotQueue.toJSON().length;
    metric.labels("polkadot").set(dotQueueLenght);

    const btcQueue: any = await api.query.bitcoinThresholdSigner.ceremonyRetryQueues(null);
    const btcQueueLenght: number = btcQueue.toJSON().length;
    metric.labels("bitcoin").set(btcQueueLenght);

    const ethQueue: any = await api.query.ethereumThresholdSigner.ceremonyRetryQueues(null);
    const ethQueueLenght: number = ethQueue.toJSON().length;
    metric.labels("ethereum").set(ethQueueLenght);

  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
