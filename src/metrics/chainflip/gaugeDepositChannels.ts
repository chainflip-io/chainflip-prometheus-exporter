import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { FlipConfig } from '../../config/interfaces';
import { Axios } from 'axios';
import { env } from '../../config/getConfig';

const metricName: string = 'cf_open_deposit_channels';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'The number of open deposit channels',
    labelNames: ['deposit_chain'],
    registers: [],
});

export const gaugeDepositChannels = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_deposit_channels')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        // BTC
        const btcChannels = context.data.open_deposit_channels.bitcoin;
        metric.labels('bitcoin').set(btcChannels);

        // DOT
        const dotChannels = context.data.open_deposit_channels.polkadot;
        metric.labels('polkadot').set(dotChannels);

        // ETH
        const ethChannels = context.data.open_deposit_channels.ethereum;
        metric.labels('ethereum').set(ethChannels);

        // ARB
        const arbChannels = context.data.open_deposit_channels.arbitrum;
        metric.labels('arbitrum').set(arbChannels);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
