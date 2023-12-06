// List of custom RPC calls and their corresponding config to be passed to the custom RPC API.
// This requires the string encoded "return" types to be passed in to the instantiated polkadot instance as well.
export const customRpcs = {
    cf: {
        is_auction_phase: {
            params: [],
            type: 'bool',
            description: 'Check if the auction phase is active',
        },
        eth_key_manager_address: {
            params: [],
            type: 'String',
            description: '',
        },
        eth_state_chain_gateway_address: {
            params: [],
            type: 'String',
            description: '',
        },
        eth_flip_token_address: {
            params: [],
            type: 'String',
            description: '',
        },
        eth_chain_id: {
            params: [],
            type: 'u16',
            description: '',
        },
        eth_vault: {
            params: [],
            type: '(String, u32)',
            description: '',
        },
        epoch_duration: {
            params: [],
            type: 'u32',
            description: '',
        },
        tx_fee_multiplier: {
            params: [],
            type: 'Amount',
            description: '',
        },
        auction_parameters: {
            params: [],
            type: '(u32, u32)',
            description: '',
        },
        min_funding: {
            params: [],
            type: 'u128',
            description: '',
        },
        current_epoch: {
            params: [],
            type: 'u32',
            description: '',
        },
        current_epoch_started_at: {
            params: [],
            type: 'u32',
            description: '',
        },
        authority_emission_per_block: {
            params: [],
            type: 'Amount',
            description: '',
        },
        backup_emission_per_block: {
            params: [],
            type: 'Amount',
            description: '',
        },
        flip_supply: {
            params: [],
            type: '(Amount, Amount)',
            description: '',
        },
        accounts: {
            params: [
                {
                    name: 'at',
                    type: 'Option<String>',
                    isOptional: true,
                },
            ],
            type: 'Vec<(ValidatorId, String)>',
            description: '',
        },
        account_info_v2: {
            params: [
                {
                    name: 'account_id',
                    type: 'ValidatorId',
                },
            ],
            type: 'RpcAccountInfoV2',
            description: '',
        },
        penalties: {
            params: [],
            type: 'Vec<(Offence, RpcPenalty)>',
            description: '',
        },
        suspensions: {
            params: [],
            type: 'RpcSuspensions',
            description: '',
        },
        auction_state: {
            params: [],
            type: 'RpcAuctionState',
            description: '',
        },
    },
};
