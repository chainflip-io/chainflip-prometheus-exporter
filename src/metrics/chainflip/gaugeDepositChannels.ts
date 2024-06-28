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

const axios = new Axios({
    baseURL: env.PROCESSOR_ENDPOINT,
    timeout: 6000,
    headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
    },
});

export const gaugeDepositChannels = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_open_deposit_channels')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricName}`);
    const config = context.config as FlipConfig;
    const { accounts } = config;

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        const data = await axios.post(
            env.PROCESSOR_ENDPOINT,
            `{"query":"query GetOpenSwapChannels {\\n  channels: allSwapChannels(\\n    condition: {isExpired: false}\\n    orderBy: ISSUED_EVENT_ID_DESC\\n  ) {\\n    nodes {\\n      sourceChain\\n    }\\n  }\\n}"}`,
        );

        const channels = JSON.parse(data.data).data.channels.nodes;
        let ethChannels = 0;
        let btcChannels = 0;
        let dotChannels = 0;
        let arbChannels = 0;
        channels.forEach((channel: any) => {
            switch (channel.sourceChain) {
                case 'Ethereum':
                    ethChannels++;
                    break;
                case 'Bitcoin':
                    btcChannels++;
                    break;
                case 'Polkadot':
                    dotChannels++;
                    break;
                case 'Arbitrum':
                    arbChannels++;
            }
        });
        metric.labels('bitcoin').set(btcChannels);

        metric.labels('polkadot').set(dotChannels);

        metric.labels('ethereum').set(ethChannels);

        metric.labels('arbitrum').set(arbChannels);
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
