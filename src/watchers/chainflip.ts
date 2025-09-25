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
    gaugeBitcoinElections,
    gaugeOraclePrices,
    gaugeDelegation,
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

    startWatcher(context);
};

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
    global.prices = new Map();
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
        context.apiLatest = api;

        await api.rpc.chain.subscribeFinalizedHeads(async (header: any) => {
            const blockHash = await api.rpc.chain.getBlockHash(header.toJSON().number);
            const stateChainData = await makeRpcRequest(api, 'monitoring_data', context.blockHash);
            const data: ProtocolData = {
                header: header.toJSON().number,
                blockHash: blockHash.toJSON(),
                data: stateChainData,
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
            gaugeBitcoinElections(context, data);
            metric.set(0);
        });
    } catch (e) {
        logger.error(e);
    }
}
