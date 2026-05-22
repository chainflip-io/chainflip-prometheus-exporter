import promClient from 'prom-client';
import { Context } from '../../lib/interfaces';
import { TronConfig } from '../../config/interfaces';

const metricName: string = 'tron_token_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The TRC20 token balance of an address',
    labelNames: ['symbol', 'contract', 'address', 'alias'],
    registers: [],
});

export const gaugeTrc20Balance = async (context: Context) => {
    if (context.config.skipMetrics.includes('tron_token_balance')) {
        return;
    }
    const { logger, httpProvider, registry, metricFailure } = context;
    const config = context.config as TronConfig;
    const { wallets, tokens } = config;
    try {
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const token of tokens) {
            const contract = await httpProvider.contract().at(token.address);
            const decimals: number = Number(await contract.decimals().call());
            for (const { address, alias } of wallets) {
                const raw = await contract.balanceOf(address).call();
                const balance = Number(raw) / 10 ** decimals;
                metric
                    .labels({
                        symbol: token.symbol,
                        contract: token.address,
                        address,
                        alias,
                    })
                    .set(balance);
            }
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.debug(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
