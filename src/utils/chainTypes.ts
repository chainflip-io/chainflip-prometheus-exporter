// RPC types for the state chain expected by polkadotJS
// https://polkadot.js.org/docs/api/start/types.extend
// https://github.com/chainflip-io/chainflip-backend/blob/main/state-chain/types.json
const stateChainTypes = {
    AccountInfo: {
        nonce: 'Index',
        consumers: 'RefCount',
        providers: 'RefCount',
        sufficients: 'RefCount',
        data: 'ChainflipAccountData',
    },
    RpcAccountInfoV2: {
        balance: 'u128',
        bond: 'u128',
        last_heartbeat: 'u32',
        online_credits: 'u32',
        reputation_points: 'i32',
        keyholder_epochs: 'Vec<u32>',
        is_current_authority: 'bool',
        is_current_backup: 'bool',
        is_qualified: 'bool',
        is_online: 'bool',
        is_bidding: 'bool',
    },
    ActiveValidatorRange: '(u32,u32)',
    ActiveProposal: '(ProposalId, Timestamp)',
    Address: 'MultiAddress',
    AggKey: {
        public_key: '[u8; 32]',
        parity_bit: 'ParityBit',
    },
    AggKeyFor: 'AggKey',
    Amount: 'u128',
    AttemptCount: 'u32',
    AuctionError: {
        _enum: ['NotEnoughBidders'],
    },
    AuctionRange: '(u32,u32)',
    AuctionResult: {
        winners: 'Vec<ValidatorId>',
        minimum_active_bid: 'Amount',
    },
    AuctionPhase: {
        _enum: {
            WaitingForBids: '',
            BidsTaken: '(Vec<(ValidatorId, Amount)>)',
            ValidatorsSelected: '(Vec<ValidatorId>, Amount)',
            ConfirmedValidators: '(Vec<ValidatorId>, Amount)',
        },
    },
    BackupOrPassive: {
        _enum: ['Backup', 'Passive'],
    },
    BasisPoints: 'u32',
    Balance: 'FlipBalance',
    Bid: '(ValidatorId, Amount)',
    BlockHeightWindow: {
        from: 'u64',
        to: 'Option<u64>',
    },
    BlockNumber: 'u32',
    BoundedBTreeSet: 'BTreeSet',
    BroadcastAttemptId: 'u64',
    BroadcastId: 'u32',
    BroadcastStage: {
        _enum: ['TransactionSigning', 'Transmission'],
    },
    CallHash: '[u8;32]',
    CeremonyId: 'u64',
    ChainflipAccountData: {
        state: 'ChainflipAccountState',
        last_active_epoch: 'Option<EpochIndex>',
    },
    ChainflipAccountState: {
        _enum: {
            CurrentAuthority: '',
            HistoricalAuthority: 'BackupOrPassive',
            BackupOrPassive: 'BackupOrPassive',
        },
    },
    ChainId: {
        _enum: ['Ethereum'],
    },
    Duration: '(u64,u32)',
    Ed25519PublicKey: '[u8;32]',
    Ed25519Signature: '[u8;64]',
    EpochIndex: 'u32',
    EthereumAddress: '[u8;20]',
    EthTransactionHash: '[u8;32]',
    FailedBroadcastAttempt: {
        broadcast_id: 'BroadcastId',
        attempt_count: 'AttemptCount',
        unsigned_tx: 'UnsignedTransactionFor',
    },
    FlipAccount: {
        fund: 'Amount',
        validator_bond: 'Amount',
    },
    FlipBalance: 'u128',
    H256: '[u8; 32]',
    InternalSource: {
        _enum: {
            Account: '(ValidatorId)',
            Reserve: '(ReserveId)',
        },
    },
    ImbalanceSource: {
        _enum: {
            External: '',
            Internal: '(InternalSource)',
            Emissions: '',
        },
    },
    Ipv6Addr: 'u128',
    KeygenOutcome: {
        _enum: {
            Success: 'AggKey',
            Failure: 'BTreeSet<ValidatorId>',
        },
    },
    KeygenOutcomeFor: 'KeygenOutcome',
    KeygenResponseStatus: {
        CandidateCount: 'u32',
        RemainingCandidates: 'BTreeSet<ValidatorId>',
        SuccessVotes: 'BTreeMap<AggKeyFor, u32>',
        BlameVotes: 'BTreeMap<ValidatorId, u32>',
    },
    KeygenStatus: {
        _enum: ['Busy', 'Failed'],
    },
    KeyId: 'Vec<u8>',
    Keys: {
        aura: '[u8; 32]',
        grandpa: '[u8; 32]',
    },
    Liveness: {
        last_heartbeat: 'BlockNumber',
        banned_until: 'BlockNumber',
    },
    LookupSource: 'MultiAddress',
    NetworkState: {
        online: 'u32',
        offline: 'u32',
    },
    Nonce: 'u64',
    Offence: {
        _enum: [
            'ParticipateSigningFailed',
            'ParticipateKeygenFailed',
            'InvalidTransactionAuthored',
            'FailedToSignTransaction',
            'MissedAuthorshipSlot',
            'MissedHeartbeat',
            'GrandpaEquivocation',
        ],
    },
    OnlineCredits: 'BlockNumber',
    OnlineCreditsFor: 'BlockNumber',
    ParityBit: {
        _enum: ['Odd', 'Even'],
    },
    PayloadFor: '[u8; 32]',
    Percentage: 'u8',
    PercentageRange: {
        top: 'u8',
        bottom: 'u8',
    },
    ProposalId: 'u32',
    RegisterClaim: {
        sig_data: 'SigData',
        node_id: '[u8; 32]',
        amount: 'Uint',
        address: 'EthereumAddress',
        expiry: 'Uint',
    },
    RemainingBid: '(ValidatorId, Amount)',
    Reputation: {
        online_credits: 'OnlineCredits',
        reputation_points: 'ReputationPoints',
    },
    ReputationOf: 'Reputation',
    ReputationPenalty: {
        points: 'ReputationPoints',
        blocks: 'BlockNumber',
    },
    ReputationPoints: 'i32',
    RequestContext: {
        attempt_id: 'u8',
        retry_scheduled: 'bool',
        remaining_respondents: 'BTreeSet<ValidatorId>',
        blame_counts: 'BTreeMap<ValidatorId, u32>',
        participant_count: 'u32',
        chain_signing_context: 'SigningContext',
    },
    RpcAuctionState: {
        blocks_per_epoch: 'u32',
        current_epoch_started_at: 'u32',
        redemption_period_as_percentage: 'u8',
        min_funding: 'u128',
        auction_size_range: '(u32, u32)',
        min_active_bid: 'u128',
    },
    RpcPenalty: {
        reputation_points: 'i32',
        suspension_duration_blocks: 'u32',
    },
    RpcSuspensions: 'Vec<(Offence, Vec<(u32, ValidatorId)>)>',
    TransactionSigningAttempt: {
        broadcast_id: 'BroadcastId',
        attempt_count: 'AttemptCount',
        unsigned_tx: 'UnsignedTransactionFor',
        nominee: 'ValidatorId',
    },
    TransmissionAttempt: {
        broadcast_id: 'BroadcastId',
        attempt_count: 'AttemptCount',
        unsigned_tx: 'UnsignedTransactionFor',
        signer: 'ValidatorId',
        signed_tx: 'SignedTransactionFor',
    },
    ReserveId: '[u8;4]',
    Retired: 'bool',
    RotationStatus: {
        _enum: {
            Idle: '',
            RunAuction: '',
            AwaitingVaults: '(AuctionResult)',
            VaultsRotated: '(AuctionResult)',
            SessionRotating: '(AuctionResult)',
        },
    },
    RotationStatusOf: 'RotationStatus',
    SchnorrVerificationComponents: {
        s: '[u8; 32]',
        k_times_g_addr: '[u8; 20]',
    },
    SemVer: {
        major: 'u8',
        minor: 'u8',
        patch: 'u8',
    },
    Signature: 'SignatureFor',
    SignatureFor: 'SchnorrVerificationComponents',
    SignerIdFor: 'EthereumAddress',
    SigningContext: {
        _enum: ['PostClaimSignature', 'SetAggKeyWithAggKey', 'UpdateFlipSupply'],
    },
    SigData: {
        msg_hash: 'H256',
        sig: 'Uint',
        nonce: 'Uint',
        k_times_g_address: 'EthereumAddress',
        key_manager_address: 'EthereumAddress',
        chain_id: 'Uint',
    },
    SignedTransactionFor: 'Vec<u8>',
    FundingAttempt: '(EthereumAddress, Amount)',
    ThresholdSignature: 'ThresholdSignatureFor',
    ThresholdSignatureFor: 'SchnorrVerificationComponents',
    Timestamp: 'u64',
    TransactionHash: 'H256',
    TransactionHashFor: 'TransactionHash',
    TransmissionFailure: {
        _enum: ['TransactionRejected', 'TransactionFailed'],
    },
    Uint: 'U256',
    UnsignedTransaction: {
        chain_id: 'u64',
        max_priority_fee_per_gas: 'Option<U256>',
        max_fee_per_gas: 'Option<U256>',
        gas_limit: 'Option<U256>',
        contract: 'EthereumAddress',
        value: 'U256',
        data: 'Vec<u8>',
    },
    UnsignedTransactionFor: 'UnsignedTransaction',
    ValidatorId: 'AccountId',
    Vault: {
        public_key: 'AggKeyFor',
        active_window: 'BlockHeightWindow',
    },
    ValidatorSize: 'u32',
    AwaitingKeygen: {
        ceremony_id: 'CeremonyId',
        response_status: 'KeygenResponseStatus',
    },
    AwaitingRotation: {
        new_public_key: 'AggKeyFor',
    },
    Complete: {
        tx_hash: 'TransactionHashFor',
    },
    VaultRotationStatus: {
        _enum: {
            AwaitingKeygen: 'AwaitingKeygen',
            AwaitingRotation: 'AwaitingRotation',
            Complete: 'Complete',
        },
    },
    Version: 'SemVer',
    VoteCount: 'u32',
} as const;

export default stateChainTypes;
