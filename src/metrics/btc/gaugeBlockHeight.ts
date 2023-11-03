import promClient, { Gauge } from "prom-client";
import { Context } from "../../lib/interfaces";

const metricName: string = "btc_block_height";
const metric: Gauge = new promClient.Gauge({
  name: metricName,
  help: "Bitcoin network block height",
  registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
  const { logger, registry, bitcoinClient, metricFailure } = context;

  logger.debug(`Scraping ${metricName}`);

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  try {
    const blockChainInfo = await bitcoinClient.getBlockchainInfo();

    metric.set(Number(blockChainInfo.blocks));
  } catch (err) {
    logger.error(err);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
