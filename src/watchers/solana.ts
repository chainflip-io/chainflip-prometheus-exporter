import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import * as solanaWeb3 from '@solana/web3.js';
import { pollEndpoint } from '../utils/utils';
import { gaugeSolBalance } from '../metrics/sol/gaugeSolBalance';
import { gaugeSolNonces } from '../metrics/sol/gaugeDurableNonces';
import { gaugeTxOutcome } from '../metrics/sol/gaugeTransactionsOutcome';
import { startSubscription } from '../metrics/sol/startSubscription';

const metricName: string = 'sol_watcher_failure';
const metric: promClient.Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Solana watcher failing',
    registers: [],
});
const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

export default async function startSolanaService(context: Context) {
    context.logger.info('Starting Solana listeners');
    await startWatcher(context);
}

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;

    context = { ...context, metricFailure };
    try {
        if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        if (registry.getSingleMetric(metricFailureName) === undefined)
            registry.registerMetric(metricFailure);

        metric.set(0);
        const solanaURL = new URL(env.SOL_HTTP_ENDPOINT);
        context.connection = new solanaWeb3.Connection(solanaURL.origin, {
            httpHeaders: {
                Authorization:
                    'Basic ' +
                    Buffer.from(solanaURL.username + ':' + solanaURL.password).toString('base64'),
            },
        });

        pollEndpoint(gaugeSolBalance, context, 6);
        pollEndpoint(gaugeTxOutcome, context, 6);
        pollEndpoint(gaugeSolNonces, context, 6);
        pollEndpoint(startSubscription, context, 6);
    } catch (e) {
        logger.error(`catch: ${e}`);
        metric.set(1);
    }
}
