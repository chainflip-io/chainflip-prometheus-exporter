import { z } from 'zod';
import stateChainTypes from './chainTypes';
import { customRpcs } from './customRpcSpecification';
import axios from 'axios';
import { env } from '../config/getConfig';

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
        hexString.length(34), // if it's too large to be safe in JS, it's a hex-encoded string
        number, // otherwise it's a number
    ])
    .transform((n: any) => BigInt(n));

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
            min_active_bid: z.optional(U128),
            rotation_phase: string,
        }),
        pending_redemptions: z.object({
            total_balance: U128,
            count: U32,
        }),
        pending_broadcasts: z.object({
            ethereum: U32,
            bitcoin: U32,
            arbitrum: U32,
            solana: U32,
            assethub: U32,
        }),
        pending_tss: z.object({
            evm: U32,
            bitcoin: U32,
            solana: U32,
        }),
        open_deposit_channels: z.object({
            ethereum: U32,
            bitcoin: U32,
            arbitrum: U32,
            solana: U32,
            assethub: U32,
        }),
        fee_imbalance: z.object({
            ethereum: z.object({ Surplus: U128, Deficit: U128 }),
            bitcoin: z.object({ Surplus: U128, Deficit: U128 }),
            arbitrum: z.object({ Surplus: U128, Deficit: U128 }),
            solana: z.object({ Surplus: U128, Deficit: U128 }),
            assethub: z.object({ Surplus: U128, Deficit: U128 }),
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
        suspended_validators: z.array(Offence, U32),
        pending_swaps: U32,
        flip_supply: z.object({
            total_supply: U128,
            offchain_supply: U128,
        }),
        sol_aggkey: string,
        sol_onchain_key: string,
        sol_nonces: z.object({
            available: z.array(z.tuple([string, string])),
            unavailable: z.array(string),
        }),
        activating_key_broadcast_ids: z.object({
            ethereum: z.optional(U32),
            bitcoin: z.optional(U32),
            arbitrum: z.optional(U32),
            assethub: z.optional(U32),
            solana: z.tuple([z.optional(U32), z.optional(string)]),
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
            bound_redeem_address: z.optional(string),
            apy_bp: z.optional(U32),
            estimated_redeemable_balance: U128,
            operator: z.optional(string),
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
    // const parsed = validators[method].parse(result.toJSON());
    return result as RpcReturnValue[M];
}

export async function makeUncheckedRpcRequest(
    apiPromise: CustomApiPromise,
    method: string,
    ...args: any
): Promise<any> {
    const result: any = await apiPromise.rpc(`cf_${method}`, ...args);
    return result;
}
// export async function customRpc<M extends RpcCall>(
//     apiPromise: CustomApiPromise,
//     method: M,
//     ...args: RpcParamsMap[M]
// ): Promise<RpcReturnValue[M]> {
//     const url = env.CF_WS_ENDPOINT.split('wss');

//     const { data } = await axios.post(`https${url[1]}`, {
//         id: 1,
//         jsonrpc: '2.0',
//         method: `cf_${method}`,
//         params: args,
//     });

//     const parsed = validators[method].parse(data.result);

//     return parsed as RpcReturnValue[M];
// }
