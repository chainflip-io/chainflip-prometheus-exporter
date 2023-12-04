import { z } from "zod";
import stateChainTypes from "./chainTypes";
import { customRpcs } from "./customRpcSpecification";

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
const RpcSuspension = z.tuple([
  Offence,
  z.array(z.tuple([number, ValidatorId])),
]);
const UnformattedEthereumAddress = z
  .string()
  .regex(/^[0-9a-fA-F]{40}$/)
  .transform((s) => `0x${s}`);

const AuctionParameters = z.tuple([U32, U32]);
const CurrentEpochStartedAt = U32;
const EpochDuration = U32;

const validators = {
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
    blocks_per_epoch: EpochDuration,
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
  flip_supply: z
    .tuple([Amount, Amount])
    .transform(([totalIssuance, offchainFunds]) => ({
      totalIssuance,
      offchainFunds,
    })),
  is_auction_phase: boolean,
  min_funding: U128,
  penalties: z.array(z.tuple([Offence, RpcPenalty])),
  suspensions: z.array(RpcSuspension),
  tx_fee_multiplier: Amount,
} as const;

type RpcParamsMap = {
  account_info_v2: [idSs58: string];
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
};

type RpcCall = keyof RpcParamsMap &
  keyof typeof validators &
  keyof typeof customRpcs.cf;

export type RpcReturnValue = {
  [K in RpcCall]: z.infer<(typeof validators)[K]>;
};

export default async function makeRpcRequest<M extends RpcCall>(
  apiPromise: CustomApiPromise,
  method: M,
  ...args: RpcParamsMap[M]
): Promise<RpcReturnValue[M]> {
  const result = await apiPromise.rpc.cf[method](...args);

  const parsed = validators[method].parse(result.toJSON());
  // console.log(method, result.toJSON(), parsed);

  return parsed as RpcReturnValue[M];
}
