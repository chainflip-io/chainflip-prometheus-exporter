import promClient from 'prom-client';
import { Contract, ethers } from 'ethers';
import { Context } from '../../lib/interfaces';
import { EthConfig } from '../../config/interfaces';

const metricName: string = 'eth_flip_total_supply';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The FLIP total supply register on the FLIP contract',
    registers: [],
});

export const gaugeFlipBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('eth_flip_total_supply')) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    const config = context.config as EthConfig;
    const contract = context.contract as Contract;
    try {
        await contract.deployed();

        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        const totalSupply = await contract.totalSupply();
        const metricValue: number = Number(Number(totalSupply) / 10 ** 18);

        metric.set(metricValue);
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.error(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
