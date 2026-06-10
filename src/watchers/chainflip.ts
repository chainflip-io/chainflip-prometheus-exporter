import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import {
    countEvents,
    gatherGlobalValues,
    gaugeAuthorities,
    gaugeBlockHeight,
    gaugeBtcUtxos,
    gaugeBuildVersion,
    gaugeDepositChannels,
    gaugeEpoch,
    gaugeExternalChainsBlockHeight,
    gaugeFeeDeficit,
    gaugeFlipTotalSupply,
    gaugePendingBroadcast,
    gaugePendingRedemptions,
    gaugePriceDelta,
    gaugeRotationDuration,
    gaugeSuspendedValidator,
    gaugeSwappingQueue,
    gaugeTssRetryQueues,
    gaugeValidatorStatus,
    gaugeWitnessChainTracking,
    gaugeWitnessCount,
    gaugeSolanaNonces,
    gaugeBlockWeight,
    gaugeElections,
    gaugeOraclePrices,
    gaugeDelegation,
    gaugeLending,
} from '../metrics/chainflip';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { customRpcs } from '../utils/customRpcSpecification';
import stateChainTypes from '../utils/chainTypes';
import makeRpcRequest from '../utils/makeRpcRequest';
import { gaugeKeyActivationBroadcast } from '../metrics/chainflip/gaugeKeyActivationBroadcast';
import { ProtocolData } from '../utils/utils';
import { gaugeOpenElections } from '../metrics/chainflip/gaugeOpenElections';
import { gaugeSafeMode } from '../metrics/chainflip/gaugeSafeMode';

const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

export default async (context: Context): Promise<void> => {
    const { logger } = context;
    logger.info('Starting Chainflip listeners');

    process.on('unhandledRejection', (reason) => {
        logger.error(
            `Unhandled promise rejection: ${reason instanceof Error ? reason.stack : reason}`,
        );
    });

    startWatcher(context);
};

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;
    context = { ...context, metricFailure };
    global.rotationInProgress = false;
    const metricName: string = 'cf_watcher_failure';
    // Reuse the already-registered gauge on restart
    const metric: promClient.Gauge =
        (registry.getSingleMetric(metricName) as promClient.Gauge) ??
        new promClient.Gauge({
            name: metricName,
            help: 'Chainflip watcher failing',
            registers: [],
        });
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);
    global.currentBlock = 0;
    global.prices = new Map();

    // If the subscription stalls (connection wedged, silent half-open socket, or a
    // failed auto-reconnect) we tear the watcher down and rebuild it. We do NOT restart
    // on every `disconnected` event: polkadot auto-reconnects and resubscribes transient
    // drops within `autoConnectMs`
    const STALL_TIMEOUT_MS = 120_000; // ~20 finalized blocks
    const RESTART_DELAY_MS = 5_000;
    const WATCHDOG_INTERVAL_MS = 15_000;
    // rpc-core memoizes a registry lookup per block hash with no eviction (one entry
    // per finalized block, kept forever — see RpcCore.setRegistrySwap). Re-arming the
    // swap every N blocks replaces the memoized function and drops the stale cache.
    const REGISTRY_SWAP_RESET_BLOCKS = 100;
    let stopped = false;
    let lastHeadAt = Date.now();
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    let api: any;

    const restart = (reason: string) => {
        if (stopped) return;
        stopped = true;
        metric.set(1);
        logger.error(`Chainflip watcher restarting in ${RESTART_DELAY_MS / 1000}s: ${reason}`);
        if (watchdog) clearInterval(watchdog);
        try {
            unsubscribe?.();
        } catch (e) {
            logger.error(`Error unsubscribing finalized heads: ${e}`);
        }
        // Fully drop the old connection before spinning up a new one, otherwise we'd
        // leak a second provider/api/subscription on every restart.
        Promise.resolve()
            .then(() => api?.disconnect?.())
            .catch((e) => logger.error(`Error disconnecting api: ${e}`));
        // fire-and-forget: the new watcher manages its own lifecycle/errors
        setTimeout(() => {
            void startWatcher(context);
        }, RESTART_DELAY_MS);
    };

    try {
        const provider = new WsProvider(env.CF_WS_ENDPOINT, 5000);
        provider.on('disconnected', (err) => {
            logger.error(`ws connection closed ${err}`);
            metric.set(1);
        });
        provider.on('error', (err) => {
            logger.error(`ws provider error ${err}`);
        });
        api = await ApiPromise.create({
            provider,
            noInitWarn: true,
            types: stateChainTypes as DeepMutable<typeof stateChainTypes>,
            rpc: { ...customRpcs },
        });
        context.apiLatest = api;
        api.on('error', (err: any) => logger.error(`api error ${err}`));

        unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(async (header: any) => {
            if (stopped) return; // ignore late deliveries arriving during teardown
            try {
                const blockNumber = header.toJSON().number;
                const blockHash = (await api.rpc.chain.getBlockHash(blockNumber)).toJSON();
                logger.info(`finalized_block_stream`, {
                    blockNumber,
                    blockHash,
                });
                const stateChainData = await makeRpcRequest(api, 'monitoring_data', blockHash);

                const blockApi = await api.at(blockHash);
                // fetched once and shared: several metrics need the full signed block
                const signedBlock = await api.rpc.chain.getBlock(blockHash);
                const data: ProtocolData = {
                    blockNumber,
                    blockHash,
                    data: stateChainData,
                    blockApi,
                    signedBlock,
                };
                gatherGlobalValues(data);
                gaugeBlockHeight(context, data);
                gaugeAuthorities(context, data);
                gaugeExternalChainsBlockHeight(context, data);
                gaugeEpoch(context, data);
                gaugeSuspendedValidator(context, data);
                gaugeFlipTotalSupply(context, data);
                gaugeRotationDuration(context, data);
                gaugeBtcUtxos(context, data);
                gaugePendingRedemptions(context, data);
                gaugePendingBroadcast(context, data);
                gaugeTssRetryQueues(context, data);
                gaugeSwappingQueue(context, data);
                gaugeFeeDeficit(context, data);
                gaugeDepositChannels(context, data);
                gaugeKeyActivationBroadcast(context, data);
                gaugeSolanaNonces(context, data);

                gaugeDelegation(context, data);
                gaugeSafeMode(context, data);
                gaugeOpenElections(context, data);
                gaugeBlockWeight(context, data);
                countEvents(context, data);
                gaugeWitnessChainTracking(context, data);
                gaugeWitnessCount(context, data);
                gaugeValidatorStatus(context, data);
                gaugeBuildVersion(context, data);
                gaugePriceDelta(context, data);
                gaugeOraclePrices(context, data);
                gaugeElections(context, data);
                gaugeLending(context, data);

                if (blockNumber % REGISTRY_SWAP_RESET_BLOCKS === 0) {
                    api._rpcCore.setRegistrySwap((hash: Uint8Array) => api.getBlockRegistry(hash));
                }

                lastHeadAt = Date.now();
                metricFailure.labels('cf_exporter_block_processing').set(0);
                metric.set(0);
            } catch (e) {
                // A single bad block must not kill the subscription or surface as an
                // unhandled rejection: log it and carry on to the next finalized head.
                logger.error(
                    `Failed to process finalized head: ${e instanceof Error ? e.stack : e}`,
                );
                metricFailure.labels('cf_exporter_block_processing').set(1);
            }
        });

        lastHeadAt = Date.now();
        watchdog = setInterval(() => {
            if (stopped) return;
            const sinceLastHead = Date.now() - lastHeadAt;
            if (sinceLastHead > STALL_TIMEOUT_MS) {
                restart(`no finalized head processed for ${Math.round(sinceLastHead / 1000)}s`);
            }
        }, WATCHDOG_INTERVAL_MS);
    } catch (e) {
        logger.error(e);
        restart(`startup failure: ${e instanceof Error ? e.stack : e}`);
    }
}
