import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricNameUtxosCount: string = 'cf_btc_utxos';
const metricUtxosCount: Gauge = new promClient.Gauge({
    name: metricNameUtxosCount,
    help: 'The total number of btc utxos we currently have',
    registers: [],
});

const metricNameUtxosBalance: string = 'cf_btc_utxo_balance';
const metricUtxosBalance = new promClient.Gauge({
    name: metricNameUtxosBalance,
    help: 'Aggregated amounts from Bitcoin utxos',
    registers: [],
});

export const gaugeBtcUtxos = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_btc_utxos')) {
        return;
    }
    const { logger, registry } = context;

    logger.debug(`Scraping ${metricNameUtxosCount}, ${metricNameUtxosBalance}`);
    if (registry.getSingleMetric(metricNameUtxosCount) === undefined)
        registry.registerMetric(metricUtxosCount);
    if (registry.getSingleMetric(metricNameUtxosBalance) === undefined)
        registry.registerMetric(metricUtxosBalance);

    metricUtxosCount.set(context.data.btc_utxos.count);

    metricUtxosBalance.set(context.data.btc_utxos.total_balance);
};
