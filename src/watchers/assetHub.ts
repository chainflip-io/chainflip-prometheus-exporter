import { ApiPromise, WsProvider } from '@polkadot/api';
import { countEvents, gaugeBlockHeight, gaugeBalance } from '../metrics/assetHub';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import { pollEndpoint } from '../utils/utils';
import { clearApiAtCache } from '../utils/cleanupApiAtCache';

const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

export default async function startAssetHubService(context: Context) {
    const { logger } = context;
    logger.info('Starting AssetHub listeners');

    startWatcher(context);
}

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;
    context = { ...context, metricFailure };

    const metricName: string = 'hub_watcher_failure';
    const metric: promClient.Gauge = new promClient.Gauge({
        name: metricName,
        help: 'AssetHub watcher failing',
        registers: [],
    });
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);

    try {
        const provider = new WsProvider(env.HUB_WS_ENDPOINT, 5000);
        provider.on('disconnected', async (err) => {
            logger.error(`ws connection closed ${err}`);
            metric.set(1);
        });
        const api: ApiPromise = await ApiPromise.create({
            provider,
            noInitWarn: true,
        });
        context.api = api;
        pollEndpoint(gaugeBlockHeight, context, 6);
        pollEndpoint(gaugeBalance, { ...context }, 6);

        await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
            const blockHash = await api.rpc.chain.getBlockHash(header.toJSON().number);
            const apiAt = await api.at(blockHash);
            await countEvents({ ...context, header, apiAt });
            clearApiAtCache(api);
            metric.set(0);
        });
    } catch (e) {
        logger.error(`catch ${e}`);
    }
}
