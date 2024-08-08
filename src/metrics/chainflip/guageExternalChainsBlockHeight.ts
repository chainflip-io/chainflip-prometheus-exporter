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
    if (context.config.skipMetrics.includes('cf_external_chain_block_height')) {
        return;
    }
    const { logger, registry, metricFailure, api } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        // Ethereum
        metric.labels('ethereum').set(context.data.external_chains_height.ethereum);

        // Bitcoin
        metric.labels('bitcoin').set(context.data.external_chains_height.bitcoin);

        // Polkadot
        metric.labels('polkadot').set(context.data.external_chains_height.polkadot);

        // Arbitrum
        // TODO! change it to use the data coming from the RPC after release 1.5.1
        const arbBlockHeight = Number(
            (await api.query.arbitrumChainTracking.currentChainState()).toJSON().blockHeight,
        );
        metric.labels('arbitrum').set(arbBlockHeight);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
    registry.registerMetric(metric);
};
