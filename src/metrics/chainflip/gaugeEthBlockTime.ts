import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "cf_eth_block_time";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Ethereum block time in ms through the chainflip blockchain",
  registers: [],
});

const metricNameError: string = "cf_eth_not_updating";
const metricError: Gauge = new promClient.Gauge({
  name: metricNameError,
  help: "Ethereum block height not updating",
  registers: [],
});

let previousBlock: number = 0;
let previousTimestamp: number = 0;
// Eth block time in ms, used to be sure to update every 12s and not more frequently
// Used 13000 to keep a bit of margin, 12s real blocktime
const ethBlockTime: number = 13000;

export const gaugeEthBlockTime = async (context: Context): Promise<void> => {
  const { logger, api, registry, metricFailure } = context;
  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  if (registry.getSingleMetric(metricNameError) === undefined)
    registry.registerMetric(metricError);

  metricFailure.labels({ metric: metricName }).set(0);
  metricFailure.labels({ metric: metricNameError }).set(0);
  try {
    const timestamp: number = Number(await api.query.timestamp.now());
    const currentEthBlock: number = (
      await api.query.ethereumChainTracking.currentChainState()
    ).toHuman().blockHeight.replace(/,/g, '');
    if (previousTimestamp === 0) {
      previousTimestamp = Number(timestamp);
    }
    if (previousBlock === 0) {
      previousBlock = Number(currentEthBlock);
    }

    let metricValue: number = 0;

    if (previousTimestamp !== 0 && previousBlock !== 0) {
      if (previousBlock !== currentEthBlock) {
        metricValue =
          (timestamp - previousTimestamp) /
          (currentEthBlock - previousBlock);
        previousBlock = currentEthBlock;
        previousTimestamp = Number(timestamp);
        metric.set(metricValue);
        metricError.set(0);
      } else if (Number(timestamp) - previousTimestamp > ethBlockTime) {
        metricError.set(1);
      }
    }
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
    metricFailure.labels({ metric: metricNameError }).set(1);
  }
};
