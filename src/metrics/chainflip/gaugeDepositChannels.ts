import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricName: string = 'cf_open_deposit_channels';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of open deposit channels',
    labelNames: ['deposit_chain'],
    registers: [],
});

export const gaugeDepositChannels = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_deposit_channels')) {
        return;
    }
    const { logger, registry, metricFailure } = context;
    logger.debug('scraping', { metric: metricName, blockNumber: data.blockNumber });

    try {
        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

        // BTC
        const btcChannels = data.data.open_deposit_channels.bitcoin;
        metric.labels('bitcoin').set(btcChannels);

        // ASSETHUB
        const hubChannels = data.data.open_deposit_channels.assethub;
        metric.labels('assethub').set(hubChannels);

        // ETH
        const ethChannels = data.data.open_deposit_channels.ethereum;
        metric.labels('ethereum').set(ethChannels);

        // ARB
        const arbChannels = data.data.open_deposit_channels.arbitrum;
        metric.labels('arbitrum').set(arbChannels);

        // SOL
        const solChannels = data.data.open_deposit_channels.solana;
        metric.labels('solana').set(solChannels);

        // TRON
        const tronChannels = data.data.open_deposit_channels.tron;
        metric.labels('tron').set(tronChannels);

        metricFailure.labels({ metric: metricName }).set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
