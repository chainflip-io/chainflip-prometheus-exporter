import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameOpenElection: string = 'cf_open_elections';
const metricOpenElection: Gauge = new promClient.Gauge({
    name: metricNameOpenElection,
    help: 'The reputation of a validator',
    labelNames: ['for_chain', 'electoral_system'],
    registers: [],
});

const map = new Map([
    ['A', 'SolanaBlockHeightTracking'],
    ['B', 'SolanaFeeTracking'],
    ['C', 'SolanaIngressTracking'],
    ['D', 'SolanaNonceTracking'],
    ['EE', 'SolanaEgressWitnessing'],
    ['FF', 'SolanaLiveness'],
    ['GG', 'SolanaVaultSwapTracking'],
]);

type election_count = {
    A: number;
    B: number;
    C: number;
    D: number;
    EE: number;
    FF: number;
    GG: number;
};
export const gaugeOpenElections = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_validator')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;

    logger.debug(`Scraping ${metricNameOpenElection}`);

    if (registry.getSingleMetric(metricNameOpenElection) === undefined)
        registry.registerMetric(metricOpenElection);

    metricFailure.labels({ metric: metricNameOpenElection }).set(0);
    const count: election_count = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        EE: 0,
        FF: 0,
        GG: 0,
    };

    try {
        const api = await apiLatest.at(data.blockHash);
        const result = await api.query.solanaElections.electionProperties.entries();
        result.forEach(([_, election_properties]: any[]) => {
            const value = election_properties.toJSON();
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                const electoral_system = Object.keys(
                    value,
                )[0].toUpperCase() as keyof election_count;
                count[electoral_system] = count[electoral_system] + 1;
            } else if (value !== null) {
                count[value.toUpperCase() as keyof election_count] =
                    count[value.toUpperCase() as keyof election_count] + 1;
            }
        });

        for (const [key, value] of Object.entries(count)) {
            // console.log(`${key}, ${map.get(key)}, ${value}`)
            const full_name = map.get(key) as string;
            metricOpenElection.labels('solana', key.concat('_', full_name)).set(value);
        }
    } catch (e) {
        metricFailure.labels({ metric: metricNameOpenElection }).set(1);
    }
};
