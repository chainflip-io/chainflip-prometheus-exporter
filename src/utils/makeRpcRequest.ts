import { z } from 'zod';
import stateChainTypes from './chainTypes';
import { customRpcs } from './customRpcSpecification';

const boolean = z.boolean();
const string = z.string();
const number = z.number();
const U8 = number;
const I32 = number;
const U16 = number;
const U32 = number;

const hexString = string.regex(/^0x[0-9a-fA-F]*$/);
const U128 = z
    .union([
        hexString, // hex-encoded string of any length
        number, // or a number (for smaller values)
    ])
    .transform((n: any) => BigInt(n));

const flexibleHexString = U128;

const Amount = U128;

const Offence = z.enum(stateChainTypes.Offence._enum);
const RpcPenalty = z.tuple([number, number]);
const ValidatorId = string;
const RpcSuspension = z.tuple([Offence, z.array(z.tuple([number, ValidatorId]))]);
const UnformattedEthereumAddress = z
    .string()
    .regex(/^[0-9a-fA-F]{40}$/)
    .transform((s) => `0x${s}`);

const AuctionParameters = z.tuple([U32, U32]);
const CurrentEpochStartedAt = U32;
const EpochDuration = U32;
const VaultImbalance = z.union([z.object({ Surplus: U128 }), z.object({ Deficit: U128 })]);

// Helper function to get decimals for an asset
function getAssetDecimals(chain: string, asset: string): number {
    if (asset === 'BTC') return 1e8;
    if (asset === 'ETH') return 1e18;
    if (asset === 'SOL') return 1e9;
    if (asset === 'USDT' || asset === 'USDC') return 1e6;
    // Default fallback
    return 1e18;
}

// Helper to convert hex string to number with decimals
function hexToNumber(hexValue: string | bigint, decimals: number): number {
    const bigIntValue = typeof hexValue === 'string' ? BigInt(hexValue) : hexValue;
    return Number(bigIntValue) / decimals;
}

export const customRpcTypes = {
    account_info_v2: z.object({
        balance: U128,
        bond: U128,
        last_heartbeat: U32,
        online_credits: U32,
        reputation_points: I32,
        keyholder_epochs: z.array(U32),
        is_current_authority: boolean,
        is_current_backup: boolean,
        is_qualified: boolean,
        is_online: boolean,
        is_bidding: boolean,
    }),
    accounts: z.array(z.tuple([ValidatorId, string])),
    auction_parameters: AuctionParameters,
    auction_state: z.object({
        epoch_duration: EpochDuration,
        current_epoch_started_at: CurrentEpochStartedAt,
        redemption_period_as_percentage: U8,
        min_funding: U128,
        auction_size_range: AuctionParameters,
        min_active_bid: U128,
    }),
    authority_emission_per_block: Amount,
    backup_emission_per_block: Amount,
    current_epoch_started_at: CurrentEpochStartedAt,
    current_epoch: U32,
    epoch_duration: EpochDuration,
    eth_chain_id: U16,
    eth_flip_token_address: string,
    eth_key_manager_address: UnformattedEthereumAddress,
    eth_state_chain_gateway_address: UnformattedEthereumAddress,
    eth_vault: z.tuple([string, U32]),
    flip_supply: z.tuple([Amount, Amount]).transform(([totalIssuance, offchainFunds]) => ({
        totalIssuance,
        offchainFunds,
    })),
    is_auction_phase: boolean,
    min_funding: U128,
    penalties: z.array(z.tuple([Offence, RpcPenalty])),
    suspensions: z.array(RpcSuspension),
    tx_fee_multiplier: Amount,
    witness_count: z.object({
        failing_count: U32,
        validators: z.array(z.tuple([string, string, boolean])),
    }),
    monitoring_data: z.object({
        external_chains_height: z.object({
            bitcoin: U32,
            ethereum: U32,
            polkadot: U32,
            arbitrum: U32,
            solana: U32,
            assethub: U32,
        }),
        btc_utxos: z.object({
            total_balance: U128,
            count: U32,
        }),
        epoch: z.object({
            epoch_duration: U32,
            current_epoch_started_at: U32,
            current_epoch_index: U32,
            min_active_bid: U128.nullish(),
            rotation_phase: string,
        }),
        pending_redemptions: z.object({
            total_balance: U128,
            count: U32,
        }),
        pending_broadcasts: z.object({
            ethereum: U32,
            bitcoin: U32,
            polkadot: U32,
            arbitrum: U32,
            solana: U32,
            assethub: U32,
        }),
        pending_tss: z.object({
            evm: U32,
            bitcoin: U32,
            polkadot: U32,
            solana: U32,
        }),
        open_deposit_channels: z.object({
            ethereum: U32,
            bitcoin: U32,
            polkadot: U32,
            arbitrum: U32,
            solana: U32,
            assethub: U32,
        }),
        fee_imbalance: z.object({
            ethereum: VaultImbalance,
            polkadot: VaultImbalance,
            bitcoin: VaultImbalance,
            arbitrum: VaultImbalance,
            solana: VaultImbalance,
            assethub: VaultImbalance,
        }),
        authorities: z.object({
            authorities: U32,
            online_authorities: U32,
            backups: U32,
            online_backups: U32,
        }),
        build_version: z.object({
            spec_version: U32,
            spec_name: string,
        }),
        suspended_validators: z.array(z.tuple([Offence, U32])),
        pending_swaps: U32,
        flip_supply: z.object({
            total_supply: U128,
            offchain_supply: U128,
        }),
        sol_aggkey: string,
        dot_aggkey: string,
        sol_onchain_key: string,
        sol_nonces: z.object({
            available: z.array(z.tuple([string, string])),
            unavailable: z.array(string),
        }),
        activating_key_broadcast_ids: z.object({
            ethereum: U32.nullish(),
            bitcoin: U32.nullish(),
            polkadot: U32.nullish(),
            arbitrum: U32.nullish(),
            assethub: U32.nullish(),
            solana: z.tuple([U32.nullish(), string.nullish()]),
        }),
    }),
    monitoring_accounts_info: z.array(
        z.object({
            balance: U128,
            bond: U128,
            last_heartbeat: U32,
            reputation_points: I32,
            keyholder_epochs: z.array(U32),
            is_current_authority: boolean,
            is_qualified: boolean,
            is_online: boolean,
            is_bidding: boolean,
            bound_redeem_address: string.nullish(),
            apy_bp: U32.nullish(),
            restricted_balances: z.record(z.string(), U128).nullish(),
            estimated_redeemable_balance: U128,
            operator: string.nullish(),
        }),
    ),
    oracle_prices: z.array(
        z.object({
            price: U128,
            updated_at_oracle_timestamp: U32,
            updated_at_statechain_block: U32,
            base_asset: string,
            quote_asset: string,
        }),
    ),
    monitoring_simulate_auction: z.object({
        auction_outcome: z.object({
            winners: z.array(z.string()),
            bond: U128,
        }),
        operators_info: z.record(
            z.string(), // key: operator id
            z.object({
                operator: z.string(),
                validators: z.record(
                    z.string(), // key: validator id
                    U128,
                ),
                delegators: z.record(
                    z.string(), // key: delegator id
                    U128,
                ),
                delegation_fee_bps: z.number(),
            }),
        ),
        new_validators: z.array(z.unknown()),
        current_mab: U128,
    }),
    lending_pools: z.array(
        z
            .object({
                asset: z.object({
                    chain: string,
                    asset: string,
                }),
                total_amount: flexibleHexString,
                available_amount: flexibleHexString,
                utilisation_rate: number,
                current_interest_rate: number,
                origination_fee: number,
                liquidation_fee: number,
                interest_rate_curve: z.object({
                    interest_at_zero_utilisation: number,
                    junction_utilisation: number,
                    interest_at_junction_utilisation: number,
                    interest_at_max_utilisation: number,
                }),
            })
            .transform((data) => {
                const decimals = getAssetDecimals(data.asset.chain, data.asset.asset);
                return {
                    ...data,
                    total_amount: hexToNumber(data.total_amount, decimals),
                    available_amount: hexToNumber(data.available_amount, decimals),
                };
            }),
    ),
    loan_accounts: z.array(
        z.object({
            account: string,
            collateral_topup_asset: z
                .object({
                    chain: string,
                    asset: string,
                })
                .nullish(),
            ltv_ratio: string.nullish(),
            collateral: z.array(
                z
                    .object({
                        chain: string,
                        asset: string,
                        amount: flexibleHexString,
                    })
                    .transform((data) => {
                        const decimals = getAssetDecimals(data.chain, data.asset);
                        return {
                            ...data,
                            amount: hexToNumber(data.amount, decimals),
                        };
                    }),
            ),
            loans: z.array(
                z
                    .object({
                        loan_id: number,
                        asset: z.object({
                            chain: string,
                            asset: string,
                        }),
                        created_at: number,
                        principal_amount: flexibleHexString,
                    })
                    .transform((data) => {
                        const decimals = getAssetDecimals(data.asset.chain, data.asset.asset);
                        return {
                            ...data,
                            principal_amount: hexToNumber(data.principal_amount, decimals),
                        };
                    }),
            ),
            liquidation_status: z.union([z.unknown(), z.null()]),
        }),
    ),
    lending_pool_supply_balances: z.array(
        z
            .object({
                chain: string,
                asset: string,
                positions: z.array(
                    z.object({
                        lp_id: string,
                        total_amount: flexibleHexString,
                    }),
                ),
            })
            .transform((data) => {
                const decimals = getAssetDecimals(data.chain, data.asset);
                return {
                    ...data,
                    positions: data.positions.map((pos) => ({
                        ...pos,
                        total_amount: hexToNumber(pos.total_amount, decimals),
                    })),
                };
            }),
    ),
} as const;

type RpcParamsMap = {
    account_info_v2: [idSs58: string, at?: string];
    accounts: [at?: string];
    auction_state: [];
    auction_parameters: [];
    authority_emission_per_block: [];
    current_epoch_started_at: [];
    current_epoch: [];
    epoch_duration: [];
    eth_key_manager_address: [];
    eth_state_chain_gateway_address: [];
    flip_supply: [];
    witness_count: [hash: string, epoch_index?: number, at?: string];
    monitoring_data: [at?: string];
    monitoring_accounts_info: [accounts: string[], at?: string];
    safe_mode_statuses: [];
    oracle_prices: [asset_pair?: string, at?: string];
    monitoring_simulate_auction: [at?: string];
    lending_pools: [at?: string];
    loan_accounts: [at?: string];
    lending_pool_supply_balances: [at?: string];
};

type RpcCall = keyof RpcParamsMap & keyof typeof customRpcTypes & keyof typeof customRpcs.cf;

export type RpcReturnValue = {
    [K in RpcCall]: z.infer<(typeof customRpcTypes)[K]>;
};

export default async function makeRpcRequest<M extends RpcCall>(
    apiPromise: CustomApiPromise,
    method: M,
    ...args: RpcParamsMap[M]
): Promise<RpcReturnValue[M]> {
    const result: any = await apiPromise.rpc(`cf_${method}`, ...args);
    const jsonResult = result.toJSON ? result.toJSON() : result;
    const parsed = customRpcTypes[method].safeParse(jsonResult);
    if (!parsed.success) {
        console.error(
            `Zod parsing failed for RPC method '${method}':`,
            JSON.stringify(parsed.error.issues, null, 2),
        );
        console.error(`Raw data for '${method}':`, JSON.stringify(jsonResult).slice(0, 3000));
        throw new Error(`Zod parsing failed for RPC method '${method}'`);
    }
    return parsed.data as RpcReturnValue[M];
}

export async function makeUncheckedRpcRequest(
    apiPromise: CustomApiPromise,
    method: string,
    ...args: any
): Promise<any> {
    const result: any = await apiPromise.rpc(`cf_${method}`, ...args);
    return result;
}
