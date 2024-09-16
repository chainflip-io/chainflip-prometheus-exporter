import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import * as solanaWeb3 from '@solana/web3.js';
import { pollEndpoint, solAggKeyAddress, solanaCurrentOnChainKey } from '../utils/utils';
import { gaugeSolBalance } from '../metrics/sol/gaugeSolBalance';
import { gaugeSolNonces } from '../metrics/sol/gaugeDurableNonces';
import { gaugeTxOutcome } from '../metrics/sol/gaugeTransactionsOutcome';
import { PublicKey } from '@solana/web3.js';
import { hexToU8a } from '@polkadot/util';
import base58 from 'bs58';
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
        const provider = new solanaWeb3.Connection(env.SOL_HTTP_ENDPOINT);
        context.connection = provider;

        pollEndpoint(gaugeSolBalance, context, 6);
        pollEndpoint(gaugeTxOutcome, context, 6);
        pollEndpoint(gaugeSolNonces, context, 6);
        pollEndpoint(startSubscription, context, 6);

        const onChainKey = new PublicKey(base58.encode(hexToU8a('0x617b160552f558d7e011b20fef73e8702cf8e4169b9036fd427340b00945b5a2')));
        console.log("Current OnChain Key");
        console.log(onChainKey);
    } catch (e) {
        logger.error(`catch: ${e}`);
        metric.set(1);
    }
}
