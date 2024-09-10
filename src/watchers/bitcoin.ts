import { Context } from '../lib/interfaces';
import Client from 'bitcoin-core';
import { gaugeBlockHeight } from '../metrics/btc';
import promClient from 'prom-client';
import { BtcConfig } from '../config/interfaces';
import { pollEndpoint } from '../utils/utils';

const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

const startBitcoinService = async (context: Context) => {
    const { logger } = context;
    logger.debug('Starting Bitcoin listeners');
    await startWatcher(context);
};

async function startWatcher(context: Context) {
    const { env, registry } = context;
    context = { ...context, metricFailure };
    const config = context.config as BtcConfig;

    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);
    const bitcoinHostParts = new URL(env.BTC_HTTP_ENDPOINT);
    const { hostname, port, username, password, protocol } = bitcoinHostParts;
    const bitcoinClient = new Client({
        username,
        password,
        host: hostname,
        port: protocol === 'https:' ? 443 : Number(port),
        ssl: { enabled: protocol === 'https:' },
        network: config.network,
    });

    pollEndpoint(gaugeBlockHeight, { ...context, bitcoinClient }, 5);
}

export default startBitcoinService;
