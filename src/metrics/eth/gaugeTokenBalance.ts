import promClient from "prom-client";
import { Contract, ethers } from "ethers";
import { Context } from "../../lib/interfaces";
import { EthConfig } from "../../config/interfaces";

const metricName: string = "eth_token_balance";
const metric = new promClient.Gauge({
  name: metricName,
  help: "The token balance of an address",
  labelNames: ["symbol", "contract", "address", "alias"],
  registers: [],
});

export const gaugeTokenBalance = async (context: Context, symbol: string) => {
  const { logger, registry, metricFailure } = context;
  const config = context.config as EthConfig;
  const contract = context.contract as Contract;
  const { wallets } = config;
  try {
    logger.debug(`Scraping ${metricName}`, { symbol });

  let stateChainGatewayContract;
  config.contracts.forEach(contract => {
    if(contract.alias === "state-chain-gateway")
      stateChainGatewayContract = contract.address;
  });
  logger.debug(`Scraping ${metricName}`, { symbol });

  if (registry.getSingleMetric(metricName) === undefined)
    registry.registerMetric(metric);
  metricFailure.labels({ metric: metricName }).set(0);

  let filterToGateway;
  let transferToLogs;
  let filterFromGateway;
  let transferFromLogs;
  if(symbol === "FLIP") {
    filterToGateway = contract.filters.Transfer(null, stateChainGatewayContract);
    transferToLogs = await contract.queryFilter(filterToGateway);
    filterFromGateway = contract.filters.Transfer(stateChainGatewayContract);
    transferFromLogs = await contract.queryFilter(filterFromGateway);
  }
  let totalBalance: ethers.BigNumber;

  for (const { address, alias } of wallets) {
    try {
      totalBalance = await contract.balanceOf(address);
      let totalBalanceParsed = Number(ethers.utils.formatUnits(totalBalance, 18));
      if(symbol === "FLIP") {
        transferToLogs?.forEach(element => {
          if(element.args?.from === address) {
            totalBalanceParsed = totalBalanceParsed + Number(ethers.utils.formatUnits(element.args?.value, 18));
          }
        });
        transferFromLogs?.forEach(element => {
          if(element.args?.to === address) {
            totalBalanceParsed = totalBalanceParsed - Number(ethers.utils.formatUnits(element.args?.value, 18));
          }
        });
      }
      const contractAddress = contract.address;
      metric
        .labels({
          symbol,
          address,
          alias,
          contract: contractAddress,
        })
        .set(totalBalanceParsed);
    } catch (error) {
      logger.error(error);
      metricFailure.labels({ metric: metricName }).set(1);
    }
    metricFailure.labels({ metric: metricName }).set(0);
  } catch (error) {
    logger.error(error);
    metricFailure.labels({ metric: metricName }).set(1);
  }
};