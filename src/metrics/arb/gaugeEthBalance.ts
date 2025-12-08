import promClient from 'prom-client';
import { ethers } from 'ethers';
import { Context } from '../../lib/interfaces';
import { ArbConfig } from '../../config/interfaces';

const metricName: string = 'arb_eth_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The current balance of ETH in the wallet',
    labelNames: ['address', 'alias'],
    registers: [],
});

export const gaugeEthBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('arb_eth_balance')) {
        return;
    }
    const { logger, httpProvider, registry, metricFailure } = context;
    const config = context.config as ArbConfig;
    const { wallets } = config;
    try {
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const { address, alias } of wallets) {
            const weiBalance = await httpProvider.getBalance(address);
            const ethBalance = ethers.utils.formatEther(weiBalance);
            metric.labels({ address, alias }).set(Number(ethBalance));
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.debug(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
