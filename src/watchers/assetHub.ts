import { ApiPromise, WsProvider } from '@polkadot/api';
import { countEvents, gaugeBlockHeight, gaugeBalance } from '../metrics/assetHub';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import { describeError, pollEndpoint, RPC_TIMEOUT_MS } from '../utils/utils';

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
    const metric: promClient.Gauge =
        (registry.getSingleMetric(metricName) as promClient.Gauge) ??
        new promClient.Gauge({
            name: metricName,
            help: 'AssetHub watcher failing',
            registers: [],
        });
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);

    const STARTUP_TIMEOUT_MS = 120_000;
    const RESTART_DELAY_MS = 5_000;
    while (true) {
        let provider: WsProvider | undefined;
        let api: ApiPromise | undefined;
        let startupTimeout: ReturnType<typeof setTimeout> | undefined;
        const intervals: Array<ReturnType<typeof setInterval>> = [];
        metric.set(1);
        try {
            provider = new WsProvider(env.HUB_WS_ENDPOINT, 5000, undefined, RPC_TIMEOUT_MS);
            api = new ApiPromise({ provider, noInitWarn: true, rpcCacheCapacity: 1 });
            const disconnected = new Promise<never>((_resolve, reject) => {
                provider?.on('disconnected', () => {
                    reject(new Error('WebSocket disconnected'));
                });
                provider?.on('error', reject);
                api?.on('error', reject);
            });
            const timeout = new Promise<never>((_resolve, reject) => {
                startupTimeout = setTimeout(() => {
                    reject(new Error('AssetHub API initialization timed out'));
                }, STARTUP_TIMEOUT_MS);
            });
            // A timed-out attempt never resumes polling if readiness completes later.
            await Promise.race([api.isReadyOrError, disconnected, timeout]);
            clearTimeout(startupTimeout);
            const pollingContext = { ...context, api };
            intervals.push(await pollEndpoint(gaugeBlockHeight, pollingContext, 6));
            intervals.push(await pollEndpoint(gaugeBalance, pollingContext, 6));
            intervals.push(await pollEndpoint(countEvents, pollingContext, 60));
            metric.set(0);
            await disconnected;
        } catch (e) {
            metric.set(1);
            logger.error(`AssetHub watcher retrying in 5s: ${describeError(e)}`);
        } finally {
            clearTimeout(startupTimeout);
            for (const interval of intervals) clearInterval(interval);
            try {
                if (api) await api.disconnect();
                else await provider?.disconnect();
            } catch (e) {
                logger.error(`Error disconnecting AssetHub API: ${describeError(e)}`);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, RESTART_DELAY_MS));
    }
}
