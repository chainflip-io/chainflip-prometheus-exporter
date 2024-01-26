import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import {
    countEvents,
    gaugeAuthorities,
    gaugeBitcoinBalance,
    gaugeBlockHeight,
    gaugeBlocksPerEpoch,
    gaugeCurrentEpochDurationBlocks,
    gaugeFlipTotalSupply,
    gaugeRotating,
    gaugeRotationDuration,
    gaugeSuspendedValidator,
    gaugeDotBlockTime,
    gaugeEthBlockTime,
    gaugeBtcBlockTime,
    gaugeBackupValidator,
    gaugeReputation,
    gaugeBuildVersion,
    gaugeBlockWeight,
    gaugePendingRedemptions,
    gaugeValidatorStatus,
    gaugeMinActiveBid,
    eventsRotationInfo,
    gaugeTssRetryQueues,
    gaugeSwappingQueue,
    gaugeBtcUtxos,
    gaugePendingBroadcast,
    gaugeEpoch,
    gaugeWitnessChainTracking,
    gaugeWitnessCount,
    gaugeFeeDeficit,
    gaugeExternalChainsBlockHeight,
} from '../metrics/chainflip';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { customRpcs } from '../utils/customRpcSpecification';
import stateChainTypes from '../utils/chainTypes';

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

    startWatcher(context);
};

declare global {
    var rotationInProgress: boolean;
    var epochIndex: number;
    interface CustomApiPromise extends ApiPromise {
        rpc: ApiPromise['rpc'] & {
            cf: {
                [K in keyof typeof customRpcs.cf]: (...args: any[]) => Promise<any>;
            };
        };
    }

    type DeepMutable<T> = {
        -readonly [P in keyof T]: DeepMutable<T[P]>;
    };
}

async function startWatcher(context: Context) {
    const { logger, env, registry } = context;
    context = { ...context, metricFailure };
    global.rotationInProgress = false;
    const metricName: string = 'cf_watcher_failure';
    const metric: promClient.Gauge = new promClient.Gauge({
        name: metricName,
        help: 'Chainflip watcher failing',
        registers: [],
    });
    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricFailureName) === undefined)
        registry.registerMetric(metricFailure);

    try {
        const provider = new WsProvider(env.CF_WS_ENDPOINT, 5000);
        provider.on('disconnected', async (err) => {
            logger.error(`ws connection closed ${err}`);
            metric.set(1);
        });
        const api: ApiPromise = await ApiPromise.create({
            provider,
            noInitWarn: true,
            types: stateChainTypes as DeepMutable<typeof stateChainTypes>,
            rpc: { ...customRpcs },
        });

        context.api = api;
        await api.rpc.chain.subscribeNewHeads(async (header) => {
            gaugeEpoch(context);
            gaugeWitnessChainTracking(context);
            gaugeWitnessCount(context);
            gaugeExternalChainsBlockHeight(context);
            gaugeBitcoinBalance(context);
            gaugeBlockHeight({ ...context, header });
            gaugeAuthorities(context);
            gaugeCurrentEpochDurationBlocks(context);
            gaugeBlocksPerEpoch(context);
            gaugeSuspendedValidator(context);
            gaugeFlipTotalSupply(context);
            gaugeRotationDuration(context);
            gaugeDotBlockTime(context);
            gaugeEthBlockTime(context);
            gaugeBtcBlockTime(context);
            gaugeBackupValidator(context);
            gaugeReputation(context);
            gaugeBuildVersion(context);
            gaugeValidatorStatus(context);
            gaugeMinActiveBid(context);
            gaugeBtcUtxos(context);
            // gaugeBlockWeight(context);
            gaugePendingRedemptions(context);
            // The metrics below have been disabled(or partially disabled) due to an error in the decoding of the values returned
            // which polkadot API is not able to interpret and cause all the other metrics to fail
            gaugePendingBroadcast(context);
            gaugeTssRetryQueues(context);
            // gaugeSwappingQueue(context);
            gaugeFeeDeficit(context);

            metric.set(0);
        });
        await api.query.system.events(async (events: any) => {
            // we want to listen to rotation events in the same block we start rotating
            // hence we wait for this before checking the events
            await gaugeRotating(context);
            countEvents({ ...context, events });
            eventsRotationInfo({ ...context, events });
        });
    } catch (e) {
        logger.error(e);
    }
}
