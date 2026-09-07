import promClient from 'prom-client';
import { ethers } from 'ethers';
import { Context } from '../../lib/interfaces';
import { BscConfig } from '../../config/interfaces';

const metricName: string = 'bsc_bnb_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The current balance of BNB in the wallet',
    labelNames: ['address', 'alias'],
    registers: [],
});

export const gaugeBnbBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes(metricName)) {
        return;
    }
    const { logger, httpProvider, registry, metricFailure } = context;
    const config = context.config as BscConfig;
    const { wallets } = config;

    try {
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const { address, alias } of wallets) {
            const weiBalance = await httpProvider.getBalance(address);
            const bnbBalance = ethers.formatEther(weiBalance);
            metric.labels({ address, alias }).set(Number(bnbBalance));
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.error(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
