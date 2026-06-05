import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';
import { blockHeightStore } from '../../lib/blockHeightStore';

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
    logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    // Ethereum
    metric.labels('ethereum').set(data.data.external_chains_height.ethereum);
    blockHeightStore.setTracked('ethereum', data.data.external_chains_height.ethereum);

    // Bitcoin
    metric.labels('bitcoin').set(data.data.external_chains_height.bitcoin);
    blockHeightStore.setTracked('bitcoin', data.data.external_chains_height.bitcoin);

    // Assethub
    metric.labels('assethub').set(data.data.external_chains_height.assethub);
    blockHeightStore.setTracked('assethub', data.data.external_chains_height.assethub);

    // Arbitrum
    metric.labels('arbitrum').set(data.data.external_chains_height.arbitrum);
    blockHeightStore.setTracked('arbitrum', data.data.external_chains_height.arbitrum);

    // Solana
    metric.labels('solana').set(data.data.external_chains_height.solana);
    blockHeightStore.setTracked('solana', data.data.external_chains_height.solana);

    // Tron
    metric.labels('tron').set(data.data.external_chains_height.tron);
    blockHeightStore.setTracked('tron', data.data.external_chains_height.tron);
};
