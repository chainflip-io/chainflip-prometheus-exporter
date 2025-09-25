import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';
import { FlipConfig } from '../../config/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameBondDifference: string = 'cf_bond_difference';
const metricBondDifference: Gauge = new promClient.Gauge({
    name: metricNameBondDifference,
    help: 'The difference of the next epoch bond compared to the current one',
    registers: [],
    labelNames: [],
});

const metricNameCurrentBond: string = 'cf_current_bond';
const metricCurrentBond: Gauge = new promClient.Gauge({
    name: metricNameCurrentBond,
    help: 'The current epoch bond',
    registers: [],
    labelNames: [],
});

const metricNameNextBond: string = 'cf_next_bond';
const metricNextBond: Gauge = new promClient.Gauge({
    name: metricNameNextBond,
    help: 'The next epoch bond',
    registers: [],
    labelNames: [],
});

const metricNameNewValidators: string = 'cf_new_validators';
const metricNewValidators: Gauge = new promClient.Gauge({
    name: metricNameNewValidators,
    help: 'The number of new validator joining the active set the next epoch',
    registers: [],
    labelNames: [],
});

const metricNameOperatorDelegatedBalance: string = 'cf_operator_delegated_balance';
const metricOperatorDelegatedBalance: Gauge = new promClient.Gauge({
    name: metricNameOperatorDelegatedBalance,
    help: 'The amount of FLIP delegated to an operator',
    registers: [],
    labelNames: ['operator'],
});

export const gaugeDelegation = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_simulate_auction')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;
    const config = context.config as FlipConfig;

    logger.debug(
        `Scraping ${metricNameBondDifference}, ${metricNameCurrentBond}, ${metricNameNextBond}, ${metricNameNewValidators}, ${metricNameOperatorDelegatedBalance}`,
    );

    if (registry.getSingleMetric(metricNameBondDifference) === undefined)
        registry.registerMetric(metricBondDifference);
    if (registry.getSingleMetric(metricNameNewValidators) === undefined)
        registry.registerMetric(metricNewValidators);
    if (registry.getSingleMetric(metricNameNextBond) === undefined)
        registry.registerMetric(metricNextBond);
    if (registry.getSingleMetric(metricNameOperatorDelegatedBalance) === undefined)
        registry.registerMetric(metricOperatorDelegatedBalance);
    if (registry.getSingleMetric(metricNameCurrentBond) === undefined)
        registry.registerMetric(metricCurrentBond);

    metricFailure.labels({ metric: metricNameBondDifference }).set(0);
    metricFailure.labels({ metric: metricNameNewValidators }).set(0);
    metricFailure.labels({ metric: metricNameNextBond }).set(0);
    metricFailure.labels({ metric: metricNameOperatorDelegatedBalance }).set(0);
    metricFailure.labels({ metric: metricNameCurrentBond }).set(0);

    try {
        const result = await makeRpcRequest(
            apiLatest,
            'monitoring_simulate_auction',
            context.blockHash,
        );

        metricNewValidators.set(result.new_validators.length);

        const bondDifference = Number(
            (BigInt(result.auction_outcome.bond) - BigInt(result.current_mab)) / BigInt(1e18),
        );
        metricBondDifference.set(bondDifference);

        metricNextBond.set(Number(BigInt(result.auction_outcome.bond) / BigInt(1e18)));
        metricCurrentBond.set(Number(BigInt(result.current_mab) / BigInt(1e18)));

        for (const [, entry] of Object.entries(result.operators_info)) {
            let total_delegated = 0;
            for (const [, val] of Object.entries(entry.delegators)) {
                total_delegated += Number(BigInt(val)) / 1e18;
            }
            metricOperatorDelegatedBalance.labels(entry.operator).set(total_delegated);
        }
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameBondDifference }).set(1);
        metricFailure.labels({ metric: metricNameNewValidators }).set(1);
        metricFailure.labels({ metric: metricNameNextBond }).set(1);
        metricFailure.labels({ metric: metricNameOperatorDelegatedBalance }).set(1);
        metricFailure.labels({ metric: metricNameCurrentBond }).set(1);
    }
};
