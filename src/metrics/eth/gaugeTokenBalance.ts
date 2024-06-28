import promClient from 'prom-client';
import { Contract, ethers } from 'ethers';
import { Context } from '../../lib/interfaces';
import { EthConfig } from '../../config/interfaces';

const metricName: string = 'eth_token_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The token balance of an address',
    labelNames: ['symbol', 'contract', 'address', 'alias'],
    registers: [],
});

export const gaugeTokenBalance = async (context: Context, symbol: string) => {
    if (context.config.skipMetrics.includes('eth_token_balance')) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    const config = context.config as EthConfig;
    const contract = context.contract as Contract;
    const { wallets } = config;
    try {
        logger.debug(`Scraping ${metricName}`, { symbol });

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const { address, alias } of wallets) {
            const rawBalance = await contract.balanceOf(address);
            const tokenBalance = ethers.utils.formatUnits(rawBalance, 18);
            const contractAddress = contract.address;
            metric
                .labels({
                    symbol,
                    address,
                    alias,
                    contract: contractAddress,
                })
                .set(parseFloat(tokenBalance));
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.error(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
