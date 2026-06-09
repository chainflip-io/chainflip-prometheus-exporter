import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

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

export const gaugeBtcUtxos = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_btc_utxos')) {
        return;
    }
    const { logger, registry, metricFailure } = context;

    logger.debug('scraping', {
        metric: `${metricNameUtxosCount}, ${metricNameUtxosBalance}`,
        blockNumber: data.blockNumber,
    });
    try {
        if (registry.getSingleMetric(metricNameUtxosCount) === undefined)
            registry.registerMetric(metricUtxosCount);
        if (registry.getSingleMetric(metricNameUtxosBalance) === undefined)
            registry.registerMetric(metricUtxosBalance);

        metricUtxosCount.set(data.data.btc_utxos.count);

        metricUtxosBalance.set(Number(data.data.btc_utxos.total_balance));

        metricFailure.labels({ metric: metricNameUtxosCount }).set(0);
        metricFailure.labels({ metric: metricNameUtxosBalance }).set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameUtxosCount }).set(1);
        metricFailure.labels({ metric: metricNameUtxosBalance }).set(1);
    }
};
