import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricNameRequestRetryQueue: string = "cf_tss_request_retry_queue";
const metricRequestRetryQueue: Gauge = new promClient.Gauge({
  name: metricNameRequestRetryQueue,
  help: "Size of the TSS request retry queue, it contains an entry for every request of TSS we receive if it gets rescheduled",
  labelNames: ["broadcaster"],
  registers: [],
});

const metricNameCeremonyRetryQueue: string = "cf_tss_ceremony_retry_queue";
const metricPendingCeremonyRetryQueue: Gauge = new promClient.Gauge({
  name: metricNameCeremonyRetryQueue,
  help: "Size of the TSS retry queue, it contains an entry for every ceremony we are performing",
  labelNames: ["broadcaster"],
  registers: [],
});

export const gaugeTssRetryQueues = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricNameRequestRetryQueue}, ${metricNameCeremonyRetryQueue}`);

  if (registry.getSingleMetric(metricNameRequestRetryQueue) === undefined)
    registry.registerMetric(metricRequestRetryQueue);
  if (registry.getSingleMetric(metricNameCeremonyRetryQueue) === undefined)
    registry.registerMetric(metricPendingCeremonyRetryQueue);
  metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(0);
  metricFailure.labels({ metric: metricNameCeremonyRetryQueue }).set(0);


  try {
    // requestRetryQueue
    const dotRequestRetryQueue: any = await api.query.polkadotThresholdSigner.requestRetryQueue(null);
    let dotRequestRetryQueueLength: number = 0;
    dotRequestRetryQueue.toJSON().forEach((element: any[]) => {
      dotRequestRetryQueueLength += element.length;
    });
    metricRequestRetryQueue.labels("polkadot").set(dotRequestRetryQueueLength);

    const btcRequestRetryQueue: any = await api.query.bitcoinThresholdSigner.requestRetryQueue(null);
    let btcRequestRetryQueueLength: number = 0;
    btcRequestRetryQueue.toJSON().forEach((element: any[]) => {
      btcRequestRetryQueueLength += element.length;
    });
    metricRequestRetryQueue.labels("bitcoin").set(btcRequestRetryQueueLength);

    const ethRequestRetryQueue: any = await api.query.ethereumThresholdSigner.requestRetryQueue(null);
    let ethRequestRetryQueueLength: number = 0;
    ethRequestRetryQueue.toJSON().forEach((element: any[]) => {
      ethRequestRetryQueueLength += element.length;
    });
    metricRequestRetryQueue.labels("ethereum").set(ethRequestRetryQueueLength);

    // ceremonyRetryQueues
    const dotCeremonyRetryQueue: any = await api.query.polkadotThresholdSigner.ceremonyRetryQueues(null);
    let dotCeremonyRetryQueueLength: number = 0;
    dotCeremonyRetryQueue.toJSON().forEach((element: any[]) => {
      dotCeremonyRetryQueueLength += element.length;
    });
    metricPendingCeremonyRetryQueue.labels("polkadot").set(dotCeremonyRetryQueueLength);

    const btcCeremonyRetryQueue: any = await api.query.bitcoinThresholdSigner.ceremonyRetryQueues(null);
    let btcCeremonyRetryQueueLength: number = 0;
    btcCeremonyRetryQueue.toJSON().forEach((element: any[]) => {
      btcCeremonyRetryQueueLength += element.length;
    });
    metricPendingCeremonyRetryQueue.labels("bitcoin").set(btcCeremonyRetryQueueLength);

    const ethCeremonyRetryQueue: any = await api.query.ethereumThresholdSigner.ceremonyRetryQueues(null);
    let ethCeremonyRetryQueueLength: number = 0;
    ethCeremonyRetryQueue.toJSON().forEach((element: any[]) => {
      ethCeremonyRetryQueueLength += element.length;
    });
    metricPendingCeremonyRetryQueue.labels("ethereum").set(ethCeremonyRetryQueueLength);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(1);
    metricFailure.labels({ metric: metricNameCeremonyRetryQueue }).set(1);
  }
};
