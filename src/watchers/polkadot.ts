import { ApiPromise, WsProvider } from '@polkadot/api';
import { countEvents, gaugeBlockHeight } from '../metrics/polkadot';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import { pollEndpoint } from '../utils/utils';

const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

export default async function startPolkadotService(context: Context) {
    const { logger } = context;
    logger.info('Starting Polkadot listeners');

    startWatcher(context);
}

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;
    context = { ...context, metricFailure };

    const metricName: string = 'dot_watcher_failure';
    const metric: promClient.Gauge = new promClient.Gauge({
        name: metricName,
        help: 'Polkadot watcher failing',
        registers: [],
    });
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);

    try {
        const provider = new WsProvider(env.DOT_WS_ENDPOINT, 5000);
        provider.on('disconnected', async (err) => {
            logger.error(`ws connection closed ${err}`);
            metric.set(1);
        });
        const api: ApiPromise = await ApiPromise.create({
            provider,
            noInitWarn: true,
        });
        context.api = api;
        pollEndpoint(gaugeBlockHeight, context, 5);

        await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
            await countEvents({ ...context, header });
            metric.set(0);
        });
    } catch (e) {
        logger.error(`catch ${e}`);
    }
}
