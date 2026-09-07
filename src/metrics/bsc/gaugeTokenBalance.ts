import promClient from 'prom-client';
import { Contract, ethers } from 'ethers';
import { Context } from '../../lib/interfaces';
import { BscConfig } from '../../config/interfaces';

const metricName: string = 'bsc_token_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The BEP-20 token balance of an address',
    labelNames: ['symbol', 'contract', 'address', 'alias'],
    registers: [],
});

type ConfiguredTokenContract = {
    symbol: string;
    address: string;
    contract: Contract;
};

export const gaugeTokenBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes(metricName)) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    const config = context.config as BscConfig;
    const tokenContracts = context.bscTokenContracts as ConfiguredTokenContract[];
    const tokenDecimals = context.bscTokenDecimals as Map<string, number>;

    try {
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const { symbol, address: contractAddress, contract } of tokenContracts) {
            const cacheKey = contractAddress.toLowerCase();
            let decimals = tokenDecimals.get(cacheKey);
            if (decimals === undefined) {
                decimals = Number(await contract.decimals());
                if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
                    throw new Error(`Invalid decimals for BSC token ${symbol}: ${decimals}`);
                }
                tokenDecimals.set(cacheKey, decimals);
            }

            for (const { address, alias } of config.wallets) {
                const rawBalance = await contract.balanceOf(address);
                const tokenBalance = ethers.formatUnits(rawBalance, decimals);
                metric
                    .labels({
                        symbol,
                        contract: contractAddress,
                        address,
                        alias,
                    })
                    .set(Number(tokenBalance));
            }
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.error(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
