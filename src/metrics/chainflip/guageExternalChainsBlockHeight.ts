import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';

const metricName: string = 'cf_external_chain_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'External chain block height',
    labelNames: ['tracked_chain'],
    registers: [],
});

export const gaugeExternalChainsBlockHeight = async (context: Context) => {
    const { logger, registry, metricFailure, api } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        // Ethereum
        const ethBlockHeigth = Number(
            (await api.query.ethereumChainTracking.currentChainState())
                .toHuman()
                .blockHeight.replace(/,/g, ''),
        );
        metric.labels('ethereum').set(ethBlockHeigth);

        // Bitcoin
        const btcBlockHeigth = Number(
            (await api.query.bitcoinChainTracking.currentChainState())
                .toHuman()
                .blockHeight.replace(/,/g, ''),
        );
        metric.labels('bitcoin').set(btcBlockHeigth);

        // Polkadot
        const dotBlockHeigth = Number(
            (await api.query.polkadotChainTracking.currentChainState())
                .toHuman()
                .blockHeight.replace(/,/g, ''),
        );
        metric.labels('polkadot').set(dotBlockHeigth);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
    registry.registerMetric(metric);
};
