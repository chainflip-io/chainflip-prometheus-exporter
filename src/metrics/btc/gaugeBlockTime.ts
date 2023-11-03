import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "btc_block_time";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Bitcoin network block time",
  registers: [],
});

let previous: number = 0;
let lastHash: string;

export const gaugeBlockTime = async (context: Context) => {
  const { logger, registry, bitcoinClient, metricFailure } = context;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const blockChainInfo = await bitcoinClient.getBlockchainInfo();
    const block = await bitcoinClient.getBlock(blockChainInfo.bestblockhash);
    if (previous === 0) {
      previous = Number(block.time);
      lastHash = blockChainInfo.bestblockhash;
    } else if (lastHash !== blockChainInfo.bestblockhash) {
      const metricValue = Number(block.time) - previous;
      metric.set(metricValue);
      previous = Number(block.time);
      lastHash = blockChainInfo.bestblockhash;
    }
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
