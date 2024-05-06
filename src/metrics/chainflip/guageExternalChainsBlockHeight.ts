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
        const ethBlockHeight = Number(
            (await api.query.ethereumChainTracking.currentChainState()).toJSON().blockHeight,
        );
        global.ethHeight = ethBlockHeight;
        metric.labels('ethereum').set(ethBlockHeight);

        // Bitcoin
        const btcBlockHeight = Number(
            (await api.query.bitcoinChainTracking.currentChainState()).toJSON().blockHeight,
        );
        global.btcHeight = btcBlockHeight;
        metric.labels('bitcoin').set(btcBlockHeight);

        // Polkadot
        const dotBlockHeight = Number(
            (await api.query.polkadotChainTracking.currentChainState()).toJSON().blockHeight,
        );
        global.dotHeight = dotBlockHeight;
        metric.labels('polkadot').set(dotBlockHeight);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
    registry.registerMetric(metric);
};
