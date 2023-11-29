import promClient from "prom-client";
import { ethers } from "ethers";
import { Context } from "../../lib/interfaces";
import { EthConfig } from "../../config/interfaces";

const metricName: string = "eth_balance";
const metric = new promClient.Gauge({
  name: metricName,
  help: "The current balance of ETH in the wallet",
  labelNames: ["address", "alias"],
  registers: [],
});

export const gaugeEthBalance = async (context: Context) => {
  const { logger, provider, registry, metricFailure } = context;
  const config = context.config as EthConfig;
  const { wallets } = config;
  try {
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined)
      registry.registerMetric(metric);

    for (const { address, alias } of wallets) {
        const weiBalance = await provider.getBalance(address);
        const ethBalance = ethers.utils.formatEther(weiBalance);
        metric.labels({ address, alias }).set(Number(ethBalance));
    }
    metricFailure.labels({ metric: metricName }).set(0);
  } catch (error) {
    logger.debug(error);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};
