import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import {
    countEvents,
    eventsRotationInfo,
    gatherGlobalValues,
    gaugeAuthorities,
    gaugeBackupValidator,
    gaugeBitcoinBalance,
    gaugeBlockHeight,
    gaugeBlocksPerEpoch,
    gaugeBtcUtxos,
    gaugeBuildVersion,
    gaugeCurrentEpochDurationBlocks,
    gaugeDepositChannels,
    gaugeExternalChainsBlockHeight,
    gaugeFeeDeficit,
    gaugeFlipTotalSupply,
    gaugeMinActiveBid,
    gaugePendingBroadcast,
    gaugePendingRedemptions,
    gaugePriceDelta,
    gaugeRotating,
    gaugeRotationDuration,
    gaugeSuspendedValidator,
    gaugeSwappingQueue,
    gaugeTssRetryQueues,
    gaugeValidatorStatus,
    gaugeWitnessChainTracking,
    gaugeWitnessCount,
} from '../metrics/chainflip';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { customRpcs } from '../utils/customRpcSpecification';
import stateChainTypes from '../utils/chainTypes';
import makeRpcRequest from '../utils/makeRpcRequest';

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
    var dotAggKeyAddress: string;
    var currentBlock: number;
    var currentAuthorities: number;

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
    global.currentBlock = 0;
    try {
        const provider = new WsProvider(env.CF_WS_ENDPOINT, 5000);
        provider.on('disconnected', async (err) => {
            logger.error(`ws connection closed ${err}`);
            metric.set(1);
        });
        const api: any = await ApiPromise.create({
            provider,
            noInitWarn: true,
            types: stateChainTypes as DeepMutable<typeof stateChainTypes>,
            rpc: { ...customRpcs },
        });

        context.api = api;
        await api.rpc.chain.subscribeNewHeads(async (header: any) => {
            context.data = await makeRpcRequest(api, 'monitoring_data');
            gatherGlobalValues(context);
            gaugeBlockHeight({ ...context, header });
            gaugeAuthorities(context);
            gaugeWitnessChainTracking(context);
            gaugeWitnessCount(context);
            gaugeExternalChainsBlockHeight(context);
            gaugeBitcoinBalance(context);
            gaugeCurrentEpochDurationBlocks({ ...context, header });
            gaugeBlocksPerEpoch(context);
            gaugeSuspendedValidator(context);
            gaugeFlipTotalSupply(context);
            gaugeRotationDuration(context);
            gaugeBackupValidator(context);
            gaugeBuildVersion(context);
            gaugeValidatorStatus(context);
            gaugeMinActiveBid(context);
            gaugeBtcUtxos(context);
            // gaugeBlockWeight(context);
            gaugePendingRedemptions(context);
            gaugePendingBroadcast(context);
            gaugeTssRetryQueues(context);
            gaugeSwappingQueue(context);
            gaugeFeeDeficit(context);
            gaugePriceDelta(context);
            gaugeDepositChannels(context);
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
