import { Context } from '../lib/interfaces';
import { FlipConfig } from '../config/interfaces';
import promClient from 'prom-client';
import {
    countEvents,
    resetEventCountMetrics,
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
import { BlockQueue } from '../utils/blockQueue';

const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

const metricQueueDepthName: string = 'cf_exporter_block_queue_depth';
const metricQueueDepth: promClient.Gauge = new promClient.Gauge({
    name: metricQueueDepthName,
    help: 'Number of finalized blocks waiting to be processed by the exporter',
    registers: [],
});

const metricBlocksDroppedName: string = 'cf_exporter_blocks_dropped_total';
const metricBlocksDropped: promClient.Gauge = new promClient.Gauge({
    name: metricBlocksDroppedName,
    help: 'Finalized blocks dropped because the exporter fell too far behind (events for those blocks were not processed)',
    registers: [],
});

const metricProcessingDurationName: string = 'cf_exporter_block_processing_duration_ms';
const metricProcessingDuration: promClient.Gauge = new promClient.Gauge({
    name: metricProcessingDurationName,
    help: 'Wall time spent processing the last block, in milliseconds',
    registers: [],
});

const metricProcessingDurationHistName: string =
    'cf_exporter_block_processing_duration_ms_histogram';
const metricProcessingDurationHist: promClient.Histogram = new promClient.Histogram({
    name: metricProcessingDurationHistName,
    help: 'Distribution of per-block processing wall time, in milliseconds',
    buckets: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000],
    registers: [],
});

const metricLaneADurationHistName: string = 'cf_exporter_event_metrics_duration_ms_histogram';
const metricLaneADurationHist: promClient.Histogram = new promClient.Histogram({
    name: metricLaneADurationHistName,
    help: 'Distribution of the per-block event-metrics (lane A) wall time, in milliseconds',
    buckets: [250, 500, 1000, 1500, 2000, 3000, 4000, 6000, 10000],
    registers: [],
});

const metricLaneBDurationHistName: string = 'cf_exporter_state_metrics_duration_ms_histogram';
const metricLaneBDurationHist: promClient.Histogram = new promClient.Histogram({
    name: metricLaneBDurationHistName,
    help: 'Distribution of the latest-state-metrics (lane B) wall time, in milliseconds',
    buckets: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000],
    registers: [],
});

const metricLaneBSkippedName: string = 'cf_exporter_state_metrics_skipped_total';
const metricLaneBSkipped: promClient.Gauge = new promClient.Gauge({
    name: metricLaneBSkippedName,
    help: 'Times the latest-state metrics were skipped for a block because the exporter was catching up',
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

// Lane A: the strict per-block lane. Runs for EVERY finalized block, in order.
// Two kinds of metrics live here: (1) event/extrinsic-derived metrics that
// must see every block, and (2) pure monitoring_data reads (no extra RPC)
// whose values stay valid when processed in order, even if delayed — they
// keep converging toward the head while catching up instead of freezing.
async function runLaneA(context: Context, data: ProtocolData): Promise<void> {
    // Sets the globals (epochIndex, currentBlock, currentAuthorities,
    // rotationInProgress, agg keys) that the gauges below read for this block.
    gatherGlobalValues(data);

    await Promise.allSettled([
        gaugeRotationDuration(context, data),
        countEvents(context, data),
        gaugeBlockHeight(context, data),
        gaugeExternalChainsBlockHeight(context, data),
        gaugeSolanaNonces(context, data),
    ]);
}

// Lane B: latest-state metrics. Only runs when the block just processed is the
// freshest finalized head; while catching up these are skipped — reporting
// state for old blocks has no value, the next caught-up block refreshes them.
async function runLaneB(context: Context, data: ProtocolData): Promise<void> {
    // priceDelta populates global.prices, read by oraclePrices, which populates
    // global.oraclePrices, read by elections/lending — hence the chain.
    const priceChain = (async () => {
        await gaugePriceDelta(context, data);
        await gaugeOraclePrices(context, data);
        await Promise.allSettled([gaugeElections(context, data), gaugeLending(context, data)]);
    })();

    await Promise.allSettled([
        priceChain,
        gaugeAuthorities(context, data),
        gaugeEpoch(context, data),
        gaugeSuspendedValidator(context, data),
        gaugeFlipTotalSupply(context, data),
        gaugeBtcUtxos(context, data),
        gaugePendingRedemptions(context, data),
        gaugePendingBroadcast(context, data),
        gaugeTssRetryQueues(context, data),
        gaugeSwappingQueue(context, data),
        gaugeFeeDeficit(context, data),
        gaugeDepositChannels(context, data),
        gaugeKeyActivationBroadcast(context, data),
        // witness gauges are heavy (per-hash RPCs); their maps tolerate gaps,
        // so skipping them while catching up is acceptable
        gaugeWitnessChainTracking(context, data),
        gaugeWitnessCount(context, data),
        gaugeValidatorStatus(context, data),
        gaugeDelegation(context, data),
        gaugeSafeMode(context, data),
        gaugeOpenElections(context, data),
        gaugeBlockWeight(context, data),
        gaugeBuildVersion(context, data),
    ]);
}

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;
    context = { ...context, metricFailure };
    global.rotationInProgress = false;
    // A restart may have skipped blocks: cumulative event counters would
    // silently under-count, so every watcher generation starts from a clean,
    // fully re-seeded zero baseline instead (PromQL increase()/rate() treat
    // the value drop as a counter reset). No-op on the first start.
    resetEventCountMetrics(context.config as FlipConfig);
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
    if (registry.getSingleMetric(metricQueueDepthName) === undefined)
        registry.registerMetric(metricQueueDepth);
    if (registry.getSingleMetric(metricBlocksDroppedName) === undefined)
        registry.registerMetric(metricBlocksDropped);
    if (registry.getSingleMetric(metricProcessingDurationName) === undefined)
        registry.registerMetric(metricProcessingDuration);
    if (registry.getSingleMetric(metricProcessingDurationHistName) === undefined)
        registry.registerMetric(metricProcessingDurationHist);
    if (registry.getSingleMetric(metricLaneADurationHistName) === undefined)
        registry.registerMetric(metricLaneADurationHist);
    if (registry.getSingleMetric(metricLaneBDurationHistName) === undefined)
        registry.registerMetric(metricLaneBDurationHist);
    if (registry.getSingleMetric(metricLaneBSkippedName) === undefined)
        registry.registerMetric(metricLaneBSkipped);
    global.currentBlock = 0;
    global.prices = new Map();

    // If the subscription stalls (connection wedged, silent half-open socket, or a
    // failed auto-reconnect) we tear the watcher down and rebuild it. We do NOT restart
    // on every `disconnected` event: polkadot auto-reconnects and resubscribes transient
    // drops within `autoConnectMs`
    const STALL_TIMEOUT_MS = 120_000; // ~20 finalized blocks
    const RESTART_DELAY_MS = 5_000;
    const WATCHDOG_INTERVAL_MS = 15_000;
    // The worker has its own liveness check: heads arriving but no block completing
    // means the pipeline is wedged on something the per-request timeouts didn't catch.
    const WORKER_STALL_TIMEOUT_MS = 300_000;
    // Bound on the catch-up backlog: ~10 minutes of chain at 6s/block. Beyond this
    // the oldest blocks are dropped (loudly, via cf_exporter_blocks_dropped_total) —
    // staying alive and current beats replaying arbitrarily old history.
    const BLOCK_QUEUE_CAPACITY = 100;
    // rpc-core memoizes a registry lookup per block hash with no eviction (one entry
    // per finalized block, kept forever — see RpcCore.setRegistrySwap). Re-arming the
    // swap every N blocks replaces the memoized function and drops the stale cache.
    const REGISTRY_SWAP_RESET_BLOCKS = 100;
    let stopped = false;
    let lastHeadAt = Date.now();
    let lastBlockProcessedAt = Date.now();
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    let api: any;

    const queue = new BlockQueue({
        capacity: BLOCK_QUEUE_CAPACITY,
        onDrop: (count, fromBlock, toBlock) => {
            metricBlocksDropped.inc(count);
            logger.warn(
                `Exporter more than ${BLOCK_QUEUE_CAPACITY} blocks behind: dropping blocks ${fromBlock}..${toBlock} (${count})`,
            );
        },
    });

    const restart = (reason: string) => {
        if (stopped) return;
        stopped = true;
        metric.set(1);
        logger.error(`Chainflip watcher restarting in ${RESTART_DELAY_MS / 1000}s: ${reason}`);
        if (watchdog) clearInterval(watchdog);
        queue.stop(); // wakes the worker so it can observe `stopped` and exit
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

    // Processes one block at a time, in order: this single awaited pipeline is the
    // backpressure — when upstream is slow, blocks accumulate as two integers in the
    // queue instead of as concurrent pipelines on the heap.
    const runWorker = async () => {
        // queue.stop() is invoked by restart(), which is the only place that
        // also sets `stopped` — the queue state is the loop's exit signal.
        while (!queue.isStopped) {
            const blockNumber = queue.take();
            if (blockNumber === undefined) {
                await queue.waitForBlock();
                continue;
            }
            const startedAt = Date.now();
            try {
                const blockHash = (await api.rpc.chain.getBlockHash(blockNumber)).toJSON();
                logger.info(`finalized_block_stream`, { blockNumber, blockHash });
                // Leak diagnostics: correlate retained heap with block progress. A steady
                // monotonic climb here (vs. a sawtooth) confirms per-block retention.
                const mem = process.memoryUsage();
                logger.debug(`heap_usage`, {
                    blockNumber,
                    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                    rssMb: Math.round(mem.rss / 1024 / 1024),
                    externalMb: Math.round(mem.external / 1024 / 1024),
                });
                const stateChainData = await makeRpcRequest(api, 'monitoring_data', blockHash);
                const blockApi = await api.at(blockHash);
                const data: ProtocolData = {
                    blockNumber,
                    blockHash,
                    data: stateChainData,
                    blockApi,
                    signedBlock: null,
                };

                const laneAStartedAt = Date.now();
                await runLaneA(context, data);
                metricLaneADurationHist.observe(Date.now() - laneAStartedAt);

                // Lane B only runs when this block is still the freshest head
                // (re-checked after lane A so heads that arrived meanwhile defer it).
                if (queue.depth === 0) {
                    // the signed block is only consumed by lane B (witness gauges):
                    // blocks processed during catch-up skip this fetch entirely
                    const laneBStartedAt = Date.now();
                    data.signedBlock = await api.rpc.chain.getBlock(blockHash);
                    await runLaneB(context, data);
                    metricLaneBDurationHist.observe(Date.now() - laneBStartedAt);
                } else {
                    metricLaneBSkipped.inc();
                    logger.debug(`Skipping latest-state metrics while catching up`, {
                        blockNumber,
                        behindBy: queue.depth,
                    });
                }

                if (blockNumber % REGISTRY_SWAP_RESET_BLOCKS === 0) {
                    api._rpcCore.setRegistrySwap((hash: Uint8Array) => api.getBlockRegistry(hash));
                }

                metricFailure.labels('cf_exporter_block_processing').set(0);
                metric.set(0);
            } catch (e) {
                // A single bad block must not kill the worker: log it and carry on
                // to the next finalized head.
                logger.error(
                    `Failed to process block ${blockNumber}: ${e instanceof Error ? e.stack : e}`,
                );
                metricFailure.labels('cf_exporter_block_processing').set(1);
            } finally {
                lastBlockProcessedAt = Date.now();
                metricQueueDepth.set(queue.depth);
                const elapsedMs = Date.now() - startedAt;
                metricProcessingDuration.set(elapsedMs);
                metricProcessingDurationHist.observe(elapsedMs);
            }
        }
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

        // The callback stays synchronous and allocation-free: all per-block work
        // happens in the worker, which pulls block numbers off the queue in order.
        unsubscribe = await api.rpc.chain.subscribeFinalizedHeads((header: any) => {
            if (stopped) return; // ignore late deliveries arriving during teardown
            lastHeadAt = Date.now();
            queue.pushHead(header.toJSON().number);
            metricQueueDepth.set(queue.depth);
        });

        void runWorker();

        lastHeadAt = Date.now();
        lastBlockProcessedAt = Date.now();
        watchdog = setInterval(() => {
            if (stopped) return;
            const sinceLastHead = Date.now() - lastHeadAt;
            if (sinceLastHead > STALL_TIMEOUT_MS) {
                restart(`no finalized head received for ${Math.round(sinceLastHead / 1000)}s`);
                return;
            }
            const sinceLastBlock = Date.now() - lastBlockProcessedAt;
            if (queue.depth > 0 && sinceLastBlock > WORKER_STALL_TIMEOUT_MS) {
                restart(
                    `worker stalled: ${
                        queue.depth
                    } blocks queued, no block processed for ${Math.round(sinceLastBlock / 1000)}s`,
                );
            }
        }, WATCHDOG_INTERVAL_MS);
    } catch (e) {
        logger.error(e);
        restart(`startup failure: ${e instanceof Error ? e.stack : e}`);
    }
}
