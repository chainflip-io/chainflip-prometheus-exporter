import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_external_chain_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'External chain block height',
    labelNames: ['tracked_chain'],
    registers: [],
});

export const gaugeExternalChainsBlockHeight = async (context: Context, data: ProtocolData) => {
    if (context.config.skipMetrics.includes('cf_external_chain_block_height')) {
        return;
    }
    const { logger, registry } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    // Ethereum
    metric.labels('ethereum').set(data.data.external_chains_height.ethereum);

    // Bitcoin
    metric.labels('bitcoin').set(data.data.external_chains_height.bitcoin);

    // Polkadot
    metric.labels('polkadot').set(data.data.external_chains_height.polkadot);

    // Arbitrum
    metric.labels('arbitrum').set(data.data.external_chains_height.arbitrum);

    // Solana
    metric.labels('solana').set(data.data.external_chains_height.solana);
    global.solanaBlockHeight = data.data.external_chains_height.solana;
};
