import promClient from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_btc_utxo_balance';
const metric = new promClient.Gauge({
    name: metricName,
    help: 'Aggregated amounts from Bitcoin utxos',
    registers: [],
});

export const gaugeBitcoinBalance = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_btc_utxo_balance')) {
        return;
    }
    const { logger, registry, api, metricFailure } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        const bitcoinAvailableUtxos: any = await api.query.environment.bitcoinAvailableUtxos();
        const aggregatedAmount = bitcoinAvailableUtxos.reduce((acc: number, utxo: any) => {
            return acc + Number(utxo.amount);
        }, 0);
        metric.set(aggregatedAmount);
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
