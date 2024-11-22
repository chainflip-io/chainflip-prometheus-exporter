import promClient, { Counter, Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';
import { ProtocolData } from '../../utils/utils';

const metricNameRotationPhaseAttempt: string = 'cf_rotation_phase_attempts';
const metricRotationPhaseAttempt: Counter = new promClient.Counter({
    name: metricNameRotationPhaseAttempt,
    help: 'Count the number of attempts for each phase of the rotation',
    labelNames: ['phase'],
    registers: [],
});

const metricNameBanned: string = 'cf_banned_nodes';
const metricBanned: Gauge = new promClient.Gauge({
    name: metricNameBanned,
    help: 'Count the number of banned nodes during a rotation',
    registers: [],
});

const metricNameBalanceBanned: string = 'cf_balance_of_banned_nodes';
const metricBalanceBanned: Gauge = new promClient.Gauge({
    name: metricNameBalanceBanned,
    help: 'Total balance of banned nodes during a rotation',
    registers: [],
});

export const eventsRotationInfo = async (
    context: Context,
    data: ProtocolData,
    events: any,
): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_rotation_phase_attempts')) {
        return;
    }
    const { logger, registry, apiLatest } = context;

    logger.debug(
        `Scraping ${metricNameRotationPhaseAttempt}, ${metricNameBanned}, ${metricNameBalanceBanned}`,
    );

    if (registry.getSingleMetric(metricNameRotationPhaseAttempt) === undefined)
        registry.registerMetric(metricRotationPhaseAttempt);
    if (registry.getSingleMetric(metricNameBanned) === undefined)
        registry.registerMetric(metricBanned);
    if (registry.getSingleMetric(metricNameBalanceBanned) === undefined)
        registry.registerMetric(metricBalanceBanned);

    if (global.rotationInProgress) {
        for (const { event } of events) {
            if (event.section === 'validator' && event.method === 'RotationPhaseUpdated') {
                try {
                    const phase = event.data.newPhase.toJSON();
                    const phaseName = Object.keys(phase)[0];
                    metricRotationPhaseAttempt.labels(phaseName).inc();
                    const bannedNodes = phase[phaseName].banned.length;
                    metricBanned.set(bannedNodes);
                    if (bannedNodes > 0) {
                        let totalBannedBalance = 0;
                        for (const idSs58 of phase[phaseName].banned) {
                            const result = await makeRpcRequest(
                                apiLatest,
                                'account_info_v2',
                                idSs58,
                                data.blockHash,
                            );
                            totalBannedBalance += Number(result.balance) / 1e18;
                        }
                        metricBalanceBanned.set(Number(totalBannedBalance));
                    }
                } catch (e) {
                    logger.error(e);
                }
            }
        }
    } else {
        metricRotationPhaseAttempt.reset();
        metricBanned.reset();
        metricBalanceBanned.reset();
    }
};
