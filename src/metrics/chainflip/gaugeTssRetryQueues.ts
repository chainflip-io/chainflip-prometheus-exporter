import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricNameRequestRetryQueue: string = "cf_tss_request_retry_queue";
const metricRequestRetryQueue: Gauge = new promClient.Gauge({
  name: metricNameRequestRetryQueue,
  help: "Size of the TSS request retry queue, it contains an entry for every request of TSS we receive if it gets rescheduled",
  labelNames: ["broadcaster"],
  registers: [],
});

const metricNamePendingCeremonies: string = "cf_tss_pending_ceremonies";
const metricPendingCeremonies: Gauge = new promClient.Gauge({
  name: metricNamePendingCeremonies,
  help: "Size of the TSS pending ceremonies, it contains an entry for every ceremony we are performing",
  labelNames: ["broadcaster"],
  registers: [],
});

export const gaugeTssRetryQueues = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricNameRequestRetryQueue}, ${metricNamePendingCeremonies}`);

  if (registry.getSingleMetric(metricNameRequestRetryQueue) === undefined)
    registry.registerMetric(metricRequestRetryQueue);
  if (registry.getSingleMetric(metricNamePendingCeremonies) === undefined)
    registry.registerMetric(metricPendingCeremonies);
  metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(0);
  metricFailure.labels({ metric: metricNamePendingCeremonies }).set(0);


  try {
    // requestRetryQueue
    const dotRequestRetryQueue: any = await api.query.polkadotThresholdSigner.requestRetryQueue(null);
    console.log(dotRequestRetryQueue.toJSON());
    let dotRequestRetryQueueLenght: number = 0;
    dotRequestRetryQueue.toJSON().forEach((element: any[]) => {
      dotRequestRetryQueueLenght += element.length;
    });;
    metricRequestRetryQueue.labels("polkadot").set(dotRequestRetryQueueLenght);

    const btcRequestRetryQueue: any = await api.query.bitcoinThresholdSigner.requestRetryQueue(null);
    let btcRequestRetryQueueLenght: number = 0;
    btcRequestRetryQueue.toJSON().forEach((element: any[]) => {
      btcRequestRetryQueueLenght += element.length;
    });
    metricRequestRetryQueue.labels("bitcoin").set(btcRequestRetryQueueLenght);

    const ethRequestRetryQueue: any = await api.query.ethereumThresholdSigner.requestRetryQueue(null);
    let ethRequestRetryQueueLenght: number = 0;
    ethRequestRetryQueue.toJSON().forEach((element: any[]) => {
      ethRequestRetryQueueLenght += element.length;
    });
    metricRequestRetryQueue.labels("ethereum").set(ethRequestRetryQueueLenght);

    // pendingCeremonies
    const dotPendingCeremonies: any = await api.query.polkadotThresholdSigner.pendingCeremonies(null);
    console.log(dotPendingCeremonies);
    console.log(dotPendingCeremonies.toJSON());
    const dotPendingCeremoniesLenght: number = dotPendingCeremonies.length;
    console.log(dotPendingCeremoniesLenght);
    metricPendingCeremonies.labels("polkadot").set(dotPendingCeremoniesLenght);

    const btcPendingCeremonies: any = await api.query.bitcoinThresholdSigner.pendingCeremonies(null);
    const btcPendingCeremoniesLenght: number = btcPendingCeremonies.toJSON().length;
    metricPendingCeremonies.labels("bitcoin").set(btcPendingCeremoniesLenght);

    const ethPendingCeremonies: any = await api.query.ethereumThresholdSigner.pendingCeremonies(null);
    const ethPendingCeremoniesLenght: number = ethPendingCeremonies.toJSON().length;
    metricPendingCeremonies.labels("ethereum").set(ethPendingCeremoniesLenght);
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricNameRequestRetryQueue }).set(1);
    metricFailure.labels({ metric: metricNamePendingCeremonies }).set(1);
  }
};
