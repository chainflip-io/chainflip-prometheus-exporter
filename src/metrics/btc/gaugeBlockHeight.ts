import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import axios from 'axios';

const metricName: string = 'btc_block_height';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Bitcoin network block height',
    registers: [],
});

export const gaugeBlockHeight = async (context: Context) => {
    if (context.config.skipMetrics.includes('btc_block_height')) {
        return;
    }
    const { logger, registry, env, metricFailure, bitcoinClient } = context;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    metricFailure.labels({ metric: metricName }).set(0);

    try {
        let result;
        if (bitcoinClient.auth === '') {
            const data = {
                jsonrpc: '1.0',
                id: '1',
                method: 'getblockcount',
                params: [],
            };
            const response = await axios.post(env.BTC_HTTP_ENDPOINT, data, {
                headers: {
                    'Content-Type': 'text/plain',
                },
            });
            result = response.data.result;
        } else {
            const blockChainInfo = await bitcoinClient.getBlockchainInfo();
            result = blockChainInfo.blocks;
        }
        metric.set(Number(result));
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
