import { beforeEach, describe, expect, it, vi } from 'vitest';
import promClient, { Registry } from 'prom-client';
import { Context } from '../src/lib/interfaces';
import { blockHeightStore } from '../src/lib/blockHeightStore';
import { countEvents, resetEventCountMetrics } from '../src/metrics/chainflip/countEvents';
import { gaugeDepositChannels } from '../src/metrics/chainflip/gaugeDepositChannels';
import { gaugeElections } from '../src/metrics/chainflip/gaugeElections';
import { gaugeFeeDeficit } from '../src/metrics/chainflip/gaugeFeeDeficit';
import { gaugeKeyActivationBroadcast } from '../src/metrics/chainflip/gaugeKeyActivationBroadcast';
import { gaugeOpenElections } from '../src/metrics/chainflip/gaugeOpenElections';
import { gaugePendingBroadcast } from '../src/metrics/chainflip/gaugePendingBroadcast';
import { gaugeSafeMode } from '../src/metrics/chainflip/gaugeSafeMode';
import {
    formatOffenceLabel,
    gaugeSuspendedValidator,
} from '../src/metrics/chainflip/gaugeSuspendedValidator';
import { gaugeExternalChainsBlockHeight } from '../src/metrics/chainflip/guageExternalChainsBlockHeight';
import { customRpcTypes } from '../src/utils/makeRpcRequest';
import { ProtocolData } from '../src/utils/utils';

type MonitoringPayloadOptions = {
    bscFee?: { Surplus: string } | { Deficit: string };
    bscActivation?: number | null;
    suspendedValidators?: unknown[];
};

const monitoringPayload = ({
    bscFee = { Surplus: '0x1bc16d674ec80000' },
    bscActivation = null,
    suspendedValidators = [
        [{ FailedToBroadcastTransaction: 'Bsc' }, 2],
        [{ FailedLivenessCheck: 'Bsc' }, 3],
        ['MissedHeartbeat', 4],
    ],
}: MonitoringPayloadOptions = {}) => ({
    external_chains_height: {
        bitcoin: 10,
        ethereum: 20,
        polkadot: 30,
        arbitrum: 40,
        solana: 50,
        assethub: 60,
        tron: 70,
        bsc: 80,
    },
    btc_utxos: { total_balance: '0x0', count: 0 },
    epoch: {
        epoch_duration: 100,
        current_epoch_started_at: 10,
        current_epoch_index: 2,
        min_active_bid: null,
        rotation_phase: 'Idle',
    },
    pending_redemptions: { total_balance: '0x0', count: 0 },
    pending_broadcasts: {
        ethereum: 1,
        bitcoin: 2,
        polkadot: 3,
        arbitrum: 4,
        solana: 5,
        assethub: 6,
        tron: 7,
        bsc: 8,
    },
    pending_tss: { evm: 1, bitcoin: 2, polkadot: 3, solana: 4 },
    open_deposit_channels: {
        ethereum: 11,
        bitcoin: 12,
        polkadot: 13,
        arbitrum: 14,
        solana: 15,
        assethub: 16,
        tron: 17,
        bsc: 18,
    },
    fee_imbalance: {
        ethereum: { Surplus: '0x0' },
        polkadot: { Surplus: '0x0' },
        bitcoin: { Surplus: '0x0' },
        arbitrum: { Surplus: '0x0' },
        solana: { Surplus: '0x0' },
        assethub: { Surplus: '0x0' },
        tron: { Surplus: '0x0' },
        bsc: bscFee,
    },
    authorities: { authorities: 10, online_authorities: 9, backups: 4, online_backups: 3 },
    build_version: { spec_version: 20300, spec_name: 'chainflip' },
    suspended_validators: suspendedValidators,
    pending_swaps: 0,
    flip_supply: { total_supply: '0x0', offchain_supply: '0x0' },
    sol_aggkey: 'sol-aggregate-key',
    dot_aggkey: 'dot-aggregate-key',
    sol_onchain_key: 'sol-onchain-key',
    sol_nonces: { available: [], unavailable: [] },
    activating_key_broadcast_ids: {
        ethereum: null,
        bitcoin: null,
        polkadot: null,
        arbitrum: null,
        assethub: null,
        solana: [null, null],
        tron: null,
        bsc: bscActivation,
    },
});

const makeData = (data: unknown, blockApi: unknown = {}): ProtocolData => ({
    blockHash: '0x01',
    blockNumber: 100,
    data: data as ProtocolData['data'],
    blockApi,
    signedBlock: {},
});

const makeContext = (
    registry: Registry,
    options: { skipMetrics?: string[]; apiLatest?: unknown; config?: Record<string, unknown> } = {},
): Context => {
    const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    const metricFailure = new promClient.Gauge({
        name: `test_metric_scrape_failure_${Math.random().toString(16).slice(2)}`,
        help: 'test metric failures',
        labelNames: ['metric'],
        registers: [],
    });

    return {
        logger,
        registry,
        metricFailure,
        apiLatest: options.apiLatest,
        config: {
            enabled: true,
            network: 'test',
            skipMetrics: options.skipMetrics ?? [],
            ...options.config,
        },
    } as unknown as Context;
};

const metricValue = async (
    registry: Registry,
    metricName: string,
    labels: Record<string, string> = {},
): Promise<number | undefined> => {
    const result = await registry.getSingleMetric(metricName)?.get();
    return result?.values.find((sample) =>
        Object.entries(labels).every(([name, value]) => sample.labels[name] === value),
    )?.value;
};

describe('BSC protocol monitoring data', () => {
    it('parses a complete 2.3 payload and emits every direct BSC metric family', async () => {
        const parsed = customRpcTypes.monitoring_data.parse(monitoringPayload());
        expect(parsed.external_chains_height.bsc).toBe(80);
        expect(parsed.pending_broadcasts.bsc).toBe(8);
        expect(parsed.open_deposit_channels.bsc).toBe(18);
        expect(parsed.fee_imbalance.bsc).toEqual({ Surplus: 2_000_000_000_000_000_000n });
        expect(parsed.activating_key_broadcast_ids.bsc).toBeNull();

        const registry = new Registry();
        const context = makeContext(registry);
        const data = makeData(parsed);

        await gaugeExternalChainsBlockHeight(context, data);
        await gaugePendingBroadcast(context, data);
        await gaugeDepositChannels(context, data);
        await gaugeFeeDeficit(context, data);
        await gaugeKeyActivationBroadcast(context, data);
        await gaugeSuspendedValidator(context, data);

        expect(
            await metricValue(registry, 'cf_external_chain_block_height', {
                tracked_chain: 'bsc',
            }),
        ).toBe(80);
        expect(blockHeightStore.getTracked('bsc')).toBe(80);
        expect(await metricValue(registry, 'cf_pending_broadcast', { broadcaster: 'bsc' })).toBe(8);
        expect(
            await metricValue(registry, 'cf_open_deposit_channels', { deposit_chain: 'bsc' }),
        ).toBe(18);
        expect(await metricValue(registry, 'cf_fee_imbalance', { tracked_chain: 'bsc' })).toBe(2);
        expect(
            await metricValue(registry, 'cf_key_activation_broadcast', {
                external_chain: 'bsc',
            }),
        ).toBe(0);
        expect(
            await metricValue(registry, 'cf_suspended_validators', {
                offence: 'FailedToBroadcastTransaction:Bsc',
            }),
        ).toBe(2);
        expect(
            await metricValue(registry, 'cf_suspended_validators', {
                offence: 'FailedLivenessCheck:Bsc',
            }),
        ).toBe(3);

        const deficit = customRpcTypes.monitoring_data.parse(
            monitoringPayload({ bscFee: { Deficit: '0xde0b6b3a7640000' } }),
        );
        await gaugeFeeDeficit(context, makeData(deficit));
        expect(await metricValue(registry, 'cf_fee_imbalance', { tracked_chain: 'bsc' })).toBe(-1);
    });

    it('requires BSC in each version 2.3 monitoring section', () => {
        for (const section of [
            'external_chains_height',
            'pending_broadcasts',
            'open_deposit_channels',
            'fee_imbalance',
            'activating_key_broadcast_ids',
        ] as const) {
            const payload = monitoringPayload();
            delete (payload[section] as Record<string, unknown>).bsc;
            expect(customRpcTypes.monitoring_data.safeParse(payload).success).toBe(false);
        }
    });

    it('normalizes both structured 2.3 offences', () => {
        expect(formatOffenceLabel({ FailedToBroadcastTransaction: 'Bsc' })).toBe(
            'FailedToBroadcastTransaction:Bsc',
        );
        expect(formatOffenceLabel({ FailedLivenessCheck: 'Bsc' })).toBe('FailedLivenessCheck:Bsc');
    });
});

describe('2.3 election metrics', () => {
    it('emits BSC and AssetHub BHW/BW gauges and open-election identifiers', async () => {
        const electionState = (seed: number) => ({
            elections: {
                seenHeightsBelow: seed,
                highestEverOngoingElection: seed + 1,
                queuedHashElections: { hash: {} },
                queuedSafeElections: { elections: { '3': 5 } },
                ongoing: { ongoing: {} },
            },
            blockProcessor: { blocksData: {}, processedEvents: {} },
        });
        const unsynchronisedState = [
            { phase: { runningBsc: { witnessFrom: { root: 900 }, headers: [] } } },
            electionState(101),
            electionState(201),
            electionState(301),
            {},
            {},
        ];
        const assethubUnsynchronisedState = [
            { phase: { runningAssethub: { witnessFrom: { root: 1200 }, headers: [] } } },
            electionState(401),
            electionState(501),
            {},
            {},
        ];
        const bscTags = ['A', 'B', 'C', 'D', 'EE', 'FF'];
        const assethubTags = ['A', 'B', 'C', 'D', 'EE'];
        const electionKeys = (tags: string[]) =>
            tags.map((tag) => ({
                args: [
                    {
                        toJSON: () => [0, { [tag.toLowerCase()]: null }],
                    },
                ],
            }));
        const emptyElectionPallet = {
            electionProperties: { keys: vi.fn().mockResolvedValue([]) },
        };
        const blockApi = {
            query: {
                bitcoinElections: emptyElectionPallet,
                ethereumElections: emptyElectionPallet,
                arbitrumElections: emptyElectionPallet,
                solanaElections: emptyElectionPallet,
                tronElections: emptyElectionPallet,
                assethubElections: {
                    electoralUnsynchronisedState: vi.fn().mockResolvedValue({
                        toJSON: () => assethubUnsynchronisedState,
                    }),
                    electionProperties: {
                        keys: vi.fn().mockResolvedValue(electionKeys(assethubTags)),
                    },
                },
                bscElections: {
                    electoralUnsynchronisedState: vi.fn().mockResolvedValue({
                        toJSON: () => unsynchronisedState,
                    }),
                    electionProperties: { keys: vi.fn().mockResolvedValue(electionKeys(bscTags)) },
                },
            },
        };
        const registry = new Registry();
        const context = makeContext(registry, {
            skipMetrics: [
                'cf_bitcoin_elections',
                'cf_ethereum_elections',
                'cf_arbitrum_elections',
                'cf_tron_elections',
            ],
        });
        const data = makeData(customRpcTypes.monitoring_data.parse(monitoringPayload()), blockApi);

        await gaugeElections(context, data);
        await gaugeOpenElections(context, data);

        expect(await metricValue(registry, 'cf_bhw_witness_from', { tracked_chain: 'bsc' })).toBe(
            900,
        );
        for (const [instance, seenHeight] of [
            ['deposit_channels', 101],
            ['vaults', 201],
            ['key_manager', 301],
        ] as const) {
            expect(
                await metricValue(registry, 'cf_bw_seen_heights_below', {
                    tracked_chain: 'bsc',
                    bw_instance: instance,
                }),
            ).toBe(seenHeight);
            expect(
                await metricValue(registry, 'cf_bw_queued_hash_elections', {
                    tracked_chain: 'bsc',
                    bw_instance: instance,
                }),
            ).toBe(1);
            expect(
                await metricValue(registry, 'cf_bw_queued_safe_elections', {
                    tracked_chain: 'bsc',
                    bw_instance: instance,
                }),
            ).toBe(2);
        }

        for (const identifier of [
            'A_BscBlockHeightWitnesser',
            'B_BscDepositChannelWitnessing',
            'C_BscVaultDepositWitnessing',
            'D_BscKeyManagerWitnessing',
            'EE_BscFeeTracking',
            'FF_BscLiveness',
        ]) {
            expect(
                await metricValue(registry, 'cf_open_elections', {
                    for_chain: 'bsc',
                    electoral_system: identifier,
                }),
            ).toBe(1);
        }

        expect(
            await metricValue(registry, 'cf_bhw_witness_from', { tracked_chain: 'assethub' }),
        ).toBe(1200);
        for (const [instance, seenHeight] of [
            ['deposit_channels', 401],
            ['egresses', 501],
        ] as const) {
            expect(
                await metricValue(registry, 'cf_bw_seen_heights_below', {
                    tracked_chain: 'assethub',
                    bw_instance: instance,
                }),
            ).toBe(seenHeight);
            expect(
                await metricValue(registry, 'cf_bw_queued_hash_elections', {
                    tracked_chain: 'assethub',
                    bw_instance: instance,
                }),
            ).toBe(1);
            expect(
                await metricValue(registry, 'cf_bw_queued_safe_elections', {
                    tracked_chain: 'assethub',
                    bw_instance: instance,
                }),
            ).toBe(2);
        }

        for (const identifier of [
            'A_AssethubBlockHeightWitnesser',
            'B_AssethubDepositChannelWitnessing',
            'C_AssethubEgressWitnessing',
            'D_AssethubFeeTracking',
            'EE_AssethubLiveness',
        ]) {
            expect(
                await metricValue(registry, 'cf_open_elections', {
                    for_chain: 'assethub',
                    electoral_system: identifier,
                }),
            ).toBe(1);
        }
    });
});

describe('2.3 chain event metrics', () => {
    beforeEach(() => {
        resetEventCountMetrics({ accounts: [] } as never);
    });

    it('seeds every applicable chain event baseline', async () => {
        const blockApi = {
            query: {
                system: { events: vi.fn().mockResolvedValue([]) },
            },
        };
        const registry = new Registry();
        const context = makeContext(registry, {
            skipMetrics: ['cf_rotation_phase_attempts'],
            config: { accounts: [], skipEvents: [], eventLog: false },
        });
        const data = makeData(customRpcTypes.monitoring_data.parse(monitoringPayload()), blockApi);

        await countEvents(context, data);

        for (const chain of [
            'ethereum',
            'bitcoin',
            'arbitrum',
            'solana',
            'assethub',
            'tron',
            'bsc',
        ]) {
            const broadcaster = `${chain}Broadcaster`;
            const ingressEgress = `${chain}IngressEgress`;

            for (const eventName of [
                `${broadcaster}:BroadcastAborted`,
                `${broadcaster}:BroadcastTimeout`,
                `${ingressEgress}:ChannelOpeningFeePaid`,
                `${ingressEgress}:BoostedDepositLost`,
                `${ingressEgress}:TransferFallbackRequested`,
            ]) {
                const value = await metricValue(registry, 'cf_events_count_total', {
                    event: eventName,
                });
                expect(value, `missing baseline for ${eventName}`).toBe(0);
            }

            expect(await metricValue(registry, 'cf_ccm_broadcast_aborted', { broadcaster })).toBe(
                0,
            );
            expect(await metricValue(registry, 'cf_broadcast_aborted', { broadcaster })).toBe(0);
        }

        for (const chain of [
            'ethereum',
            'bitcoin',
            'arbitrum',
            'solana',
            'assethub',
            'tron',
            'bsc',
        ]) {
            expect(
                await metricValue(registry, 'cf_events_count_total', {
                    event: `${chain}ChainTracking:ChainStateUpdated`,
                }),
            ).toBe(0);
        }

        expect(
            await metricValue(registry, 'cf_events_count_total', {
                event: 'polkadotBroadcaster:BroadcastAborted',
            }),
        ).toBeUndefined();
        expect(
            await metricValue(registry, 'cf_events_count_total', {
                event: 'polkadotChainTracking:ChainStateUpdated',
            }),
        ).toBeUndefined();

        for (const signer of ['evm', 'polkadot', 'bitcoin', 'solana']) {
            for (const method of ['RetryRequested', 'KeygenFailure']) {
                expect(
                    await metricValue(registry, 'cf_events_count_total', {
                        event: `${signer}ThresholdSigner:${method}`,
                    }),
                ).toBe(0);
            }
        }

        for (const chain of ['ethereum', 'bitcoin', 'arbitrum', 'assethub', 'tron', 'bsc']) {
            expect(await metricValue(registry, 'cf_reorg_detected', { tracked_chain: chain })).toBe(
                0,
            );
        }
    });

    it('seeds the intended events, detects reorgs, and scopes CCM IDs by chain', async () => {
        let currentEvents: unknown[] = [
            event('ethereumIngressEgress', 'CcmBroadcastRequested', [7]),
            event('bscIngressEgress', 'CcmBroadcastRequested', [7]),
            event('bscBroadcaster', 'BroadcastAborted', [7]),
            event('ethereumBroadcaster', 'BroadcastAborted', [7]),
            event('bscElections', 'ElectoralEvent', [
                { reorgDetected: { reorgedBlocks: [{ root: 1000 }, { root: 1002 }] } },
            ]),
        ];
        const blockApi = {
            query: {
                system: { events: vi.fn(async () => currentEvents) },
            },
        };
        const registry = new Registry();
        const context = makeContext(registry, {
            skipMetrics: ['cf_rotation_phase_attempts'],
            config: { accounts: [], skipEvents: [], eventLog: false },
        });
        const data = makeData(customRpcTypes.monitoring_data.parse(monitoringPayload()), blockApi);

        await countEvents(context, data);

        for (const baseline of [
            'bscBroadcaster:BroadcastTimeout',
            'bscIngressEgress:ChannelOpeningFeePaid',
            'bscIngressEgress:TransferFallbackRequested',
            'bscChainTracking:ChainStateUpdated',
        ]) {
            expect(await metricValue(registry, 'cf_events_count_total', { event: baseline })).toBe(
                0,
            );
        }
        expect(
            await metricValue(registry, 'cf_events_count_total', {
                event: 'bscBroadcaster:BroadcastAborted',
            }),
        ).toBe(1);
        expect(
            await metricValue(registry, 'cf_events_count_total', {
                event: 'bscIngressEgress:BoostedDepositLost',
            }),
        ).toBe(0);
        expect(
            await metricValue(registry, 'cf_ccm_broadcast_aborted', {
                broadcaster: 'bscBroadcaster',
            }),
        ).toBe(1);
        expect(
            await metricValue(registry, 'cf_ccm_broadcast_aborted', {
                broadcaster: 'ethereumBroadcaster',
            }),
        ).toBe(1);
        expect(
            await metricValue(registry, 'cf_broadcast_aborted', {
                broadcaster: 'bscBroadcaster',
            }),
        ).toBe(0);
        expect(await metricValue(registry, 'cf_reorg_detected', { tracked_chain: 'bsc' })).toBe(3);
        expect(
            await metricValue(registry, 'cf_reorg_detected', { tracked_chain: 'assethub' }),
        ).toBe(0);

        currentEvents = [
            event('assethubElections', 'ElectoralEvent', [
                { reorgDetected: { reorgedBlocks: [{ root: 2000 }, { root: 2002 }] } },
            ]),
        ];
        await countEvents(context, { ...data, blockNumber: 101 });
        expect(await metricValue(registry, 'cf_reorg_detected', { tracked_chain: 'bsc' })).toBe(0);
        expect(
            await metricValue(registry, 'cf_reorg_detected', { tracked_chain: 'assethub' }),
        ).toBe(3);

        currentEvents = [];
        await countEvents(context, { ...data, blockNumber: 102 });
        expect(
            await metricValue(registry, 'cf_reorg_detected', { tracked_chain: 'assethub' }),
        ).toBe(0);
    });
});

describe('generic BSC protocol paths', () => {
    it('flattens BSC safe-mode statuses without chain-specific production logic', async () => {
        const safeModeStatuses = {
            broadcast_bsc: { broadcast_enabled: true },
            ingress_egress_bsc: { deposit_channel_creation_enabled: false },
            bsc_elections: { elections_enabled: true },
            witnesser: {
                bsc_broadcast: true,
                bsc_chain_tracking: false,
                bsc_ingress_egress: true,
                bsc_vault: false,
            },
        };
        const apiLatest = {
            rpc: vi.fn().mockResolvedValue(safeModeStatuses),
        };
        const registry = new Registry();
        const context = makeContext(registry, { apiLatest });
        const data = makeData(customRpcTypes.monitoring_data.parse(monitoringPayload()));

        await gaugeSafeMode(context, data);

        for (const [name, expected] of [
            ['broadcast_bsc.broadcast_enabled', 0],
            ['ingress_egress_bsc.deposit_channel_creation_enabled', 1],
            ['bsc_elections.elections_enabled', 0],
            ['witnesser.bsc_broadcast', 0],
            ['witnesser.bsc_chain_tracking', 1],
            ['witnesser.bsc_ingress_egress', 0],
            ['witnesser.bsc_vault', 1],
        ] as const) {
            expect(await metricValue(registry, 'cf_safe_mode', { name })).toBe(expected);
        }
    });

    it('converts BSC lending amounts using 18 decimals across all RPC shapes', () => {
        const pools = customRpcTypes.lending_pools.parse([
            lendingPool('BNB', '0xde0b6b3a7640000'),
            lendingPool('USDT', '0x1bc16d674ec80000'),
        ]);
        expect(pools.map(({ total_amount }) => total_amount)).toEqual([1, 2]);

        const accounts = customRpcTypes.loan_accounts.parse([
            {
                account: 'account',
                collateral_topup_asset: null,
                ltv_ratio: null,
                collateral: [
                    {
                        chain: 'Bsc',
                        asset: 'BNB',
                        amount: '0x29a2241af62c0000',
                    },
                ],
                loans: [
                    {
                        loan_id: 1,
                        asset: { chain: 'Bsc', asset: 'USDT' },
                        created_at: 1,
                        principal_amount: '0x3782dace9d900000',
                    },
                ],
                liquidation_status: null,
            },
        ]);
        expect(accounts[0].collateral[0].amount).toBe(3);
        expect(accounts[0].loans[0].principal_amount).toBe(4);

        const supplies = customRpcTypes.lending_pool_supply_balances.parse([
            {
                chain: 'Bsc',
                asset: 'USDT',
                positions: [{ lp_id: 'lp', total_amount: '0x4563918244f40000' }],
            },
        ]);
        expect(supplies[0].positions[0].total_amount).toBe(5);
    });
});

function event(section: string, method: string, json: unknown) {
    return {
        event: {
            section,
            method,
            data: { toJSON: () => json },
        },
    };
}

function lendingPool(asset: string, totalAmount: string) {
    return {
        asset: { chain: 'Bsc', asset },
        total_amount: totalAmount,
        available_amount: totalAmount,
        utilisation_rate: 0,
        current_interest_rate: 0,
        origination_fee: 0,
        liquidation_fee: 0,
        interest_rate_curve: {
            interest_at_zero_utilisation: 0,
            junction_utilisation: 0,
            interest_at_junction_utilisation: 0,
            interest_at_max_utilisation: 0,
        },
    };
}
