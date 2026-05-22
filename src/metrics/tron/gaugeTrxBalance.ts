import promClient from 'prom-client';
import { Context } from '../../lib/interfaces';
import { TronConfig } from '../../config/interfaces';

const metricName: string = 'tron_trx_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'The current balance of TRX in the wallet',
    labelNames: ['address', 'alias'],
    registers: [],
});

export const gaugeTrxBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('tron_trx_balance')) {
        return;
    }
    const { logger, httpProvider, registry, metricFailure } = context;
    const config = context.config as TronConfig;
    const { wallets } = config;
    try {
        logger.debug(`Scraping ${metricName}`);

        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        for (const { address, alias } of wallets) {
            const sunBalance = await httpProvider.trx.getBalance(address);
            const trxBalance = Number(sunBalance) / 1e6;
            metric.labels({ address, alias }).set(trxBalance);
        }
        metricFailure.labels({ metric: metricName }).set(0);
    } catch (error) {
        logger.debug(error);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
