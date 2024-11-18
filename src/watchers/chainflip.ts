import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import {
    countEvents,
    eventsRotationInfo,
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
} from '../metrics/chainflip';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { customRpcs } from '../utils/customRpcSpecification';
import stateChainTypes from '../utils/chainTypes';
import makeRpcRequest from '../utils/makeRpcRequest';
import { gaugeKeyActivationBroadcast } from '../metrics/chainflip/gaugeKeyActivationBroadcast';

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

        await api.rpc.chain.subscribeFinalizedHeads(async (header: any) => {
            context.header = header;
            context.blockHash = await api.rpc.chain.getBlockHash(header.toJSON().number);
            context.api = await api.at(context.blockHash);
            context.data = await makeRpcRequest(api, 'monitoring_data', context.blockHash);
            gatherGlobalValues(context);
            gaugeBlockHeight({ ...context });
            gaugeAuthorities(context);
            gaugeExternalChainsBlockHeight(context);
            gaugeEpoch({ ...context });
            gaugeSuspendedValidator(context);
            gaugeFlipTotalSupply(context);
            gaugeRotationDuration(context);
            gaugeBtcUtxos(context);
            gaugePendingRedemptions(context);
            gaugePendingBroadcast(context);
            gaugeTssRetryQueues(context);
            gaugeSwappingQueue(context);
            gaugeFeeDeficit(context);
            gaugeDepositChannels(context);
            gaugeKeyActivationBroadcast(context);
            gaugeSolanaNonces(context);
            // need to read some storage
            gaugeBlockWeight(context);
            try {
                const events = await context.api.query.system.events();
                context.api = await api;
                countEvents({ ...context, events });
                eventsRotationInfo({ ...context, events });
                metricFailure.labels('events_metrics').set(0);
            } catch (e) {
                logger.error(e);
                metricFailure.labels('events_metrics').set(1);
            }

            // These need the basic api + blockHash separately
            context.api = await api;
            gaugeWitnessChainTracking(context);
            gaugeWitnessCount(context);
            gaugeValidatorStatus(context);
            gaugeBuildVersion(context);
            gaugePriceDelta(context);
            metric.set(0);
        });
    } catch (e) {
        logger.error(e);
    }
}
