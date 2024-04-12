# Prometheus exporter

## How to write a new metric:

- In order to create a new metric you need to clone our prometheus-exporter repo ([chainflip-prometheus-exporter](https://github.com/chainflip-io/chainflip-prometheus-exporter))
- For this example we will create a new chainflip metric (cf_), all the necessary code is located under `src/`
- `watchers/chainflip.ts` here is the main loop responsible for gathering chainflip metrics, we listen to new blocks and every time a new one is received we update the different metrics based on the new state of the chain.
    - You just have to add a call to the new metric function
- create the new metric function inside `src/metrics/chainflip/`
    - You can copy paste another existing metric as reference (I.E. `gaugeBtcUtxos.ts` is a good and simple example)
    - Here you need to modify your metrics values (`metricName`, `help`, and `labelNames` if your metric have more labels)
        >       const metricName: string = 'cf_btc_utxos';
        >       const metric: Gauge = new promClient.Gauge({
        >           name: metricName,
        >           help: 'The total number of btc utxos we currently have',
        >           registers: [],
        >           labelNames: ["labelA", "labelB"]
        >       });
    - Then modify the logic to gether that metric:
        - The following line is required to add our metric to the registry (if not it won’t be exported)
        >       if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
        - Then we simply query the data we need (could be a storage item, a custom rpc, etc..) and we set the previously created metric to the value we need.
        >       const utxos: any = await api.query.environment.bitcoinAvailableUtxos();
        >       const metricValue: number = utxos.length;
        >       metric.set(metricValue);
    
    You should be able to create new metrics just by following what’s been done already, all the metrics follow the same structure.

## Following is a detailed description of each metric 

Metric starting with `cf_` represent chainflip metrics coming from the prometheus exporter

Metric starting with `cfe_` represent chainflip metrics coming from the engine

Metric starting with `btc_/eth_/dot_` represent external chains metrics coming from the prometheus exporter (values gathered from the external chains endpoints)

There are mainly 2 types of metric you need to know about:
- Gauges: support any value (positive or negative), you can set it to an arbitrary value at any point in time
- Counters: support only positive values, and can be modified only by incrementing/decrementing it (by any amount)
- Other metrics type: https://prometheus.io/docs/concepts/metric_types/

Every metric in prometheus can have a set of labels, for every labels combination a different time-series is created and stored.
I.E. **cf_test{ chain, network }** where:
- chain: Eth | Btc | Dot
- network: mainnet | testnet

This will create 6 different time series, each one being a combination of the labels values

    cf_test{chain=”Btc”, network=”mainnet”}
    cf_test{chain=”Btc”, network=”testnet”}
    cf_test{chain=”Eth”, network=”mainnet”}
    cf_test{chain=”Eth”, network=”testnet”}
    cf_test{chain=”Dot”, network=”mainnet”}
    cf_test{chain=”Dot”, network=”testnet”}

#### Metrics list:
- **cf_events_count_total{ event }**: counts the number of events emitted by the state-chain, it has one label describing the event being observed
- **cf_node_slashed{ event, ss58, publicKey, alias}**: counts the number of times a validator gets slashed
- **cf_rotation_phase_attempts{ phase }**: counts the number of attempts for each phase of a rotation
- **cf_banned_nodes{}:** counts the number of banned nodes during a rotation
- **cf_balance_of_banned_nodes{}**: the total balance of the banned nodes during a rotation
- **cf_authorities{}**: the number of authorities in the active set
- **cf_authorities_online{}**: the number of online authorities in the active set
- **cf_backup_validator{}**: the number of validators in the backup set
- **cf_backup_validator_online{}**: the number of online validators in the backup set
- **cf_btc_utxo_balance{}**: the sum of all the balances of the UTXOs in the vault
- **cf_btc_utxos{}**: the number of UTXOs in the vault
- **cf_block_per_epoch{}**: the number of blocks for each epoch
- **cf_build_version{}**: Current version of the runtime and node
- **cf_current_epoch_duration_blocks{}**: the duration of the current epoch in blocks
- **cf_open_deposit_channels{ deposit_chain }**: The number of open deposit channels
- **cf_fee_deficit{ tracked_chain }**: The fee deficit (witheld fee - fee actually spent). Currently only working for eth and dot since for btc is not as straightforward
- **cf_flip_total_supply{}**: Total number of flip issued
- **cf_min_active_bid{}**: The current MAB
- **cf_pending_broadcast{ broadcaster }**: The number of broadcasts currently being processed
- **cf_pending_redemptions{}**: The number of pending redemptions
- **cf_pending_redemptions_balance{}**: The sum of balances across all the pending redemptions
- **cf_price_delta_to_usdc{ fromAsset, amount }**: The current price delta from the given token and amount to USDC
- **cf_price_delta_from_usdc{ toAsset, amount }**: The current price delta from a given amount of USDC to the given token
- **cf_quote_unavailable{ fromAsset, toAsset, amount }**: If == to 1 means we don't have a quote for the given asset and amount
- **cf_reputation{ ss58, alias }**: The reputation of a validator
- **cf_rotating{}**: Is the network rotating (1 == true)
- **cf_rotation_duration{}**: The duration of the current rotation in blocks
- **cf_rotation_phase_duration{ phase }**: The duration of the current phase in blocks
- **cf_suspended_validators{ offence }**: The number of validator suspended for a given offence
- **cf_tss_request_retry_queue{ tss }**: Size of the TSS request retry queue, it contains an entry for every request of TSS we receive if it gets rescheduled
- **cf_tss_ceremony_retry_queue{ tss }**: Size of the TSS ceremony retry queue, it contains an entry for every ceremony with a block at which it should be retried
- **cf_validator_online{ ss58Address, alias }:** Tracked validator is online
- **cf_validator_authority{ ss58Address, alias }:** Tracked validator is authority
- **cf_validator_backup{ ss58Address, alias }:** Tracked validator is backup
- **cf_validator_qualified{ ss58Address, alias }:** Tracked validator is qualified
- **cf_validator_bidding{ ss58Address, alias }:** Tracked validator is bidding
- **cf_validator_balance{ ss58Address, alias }:** Validator balance amount (bidding amount)
- **cf_chain_tracking_witness_count{ extrinsic, marginBlocks }**: Number of validator witnessing ChainStateUpdated for an external chain
- **cf_witness_count { extrinsic, marginBlocks }**: Number of validator witnessing an extrinsic
- **cf_block_height{}**: Chainflip network block height
- **cf_external_chain_block_height{ tracked_chain }:** External chain block height

- **btc_block_height/eth_block_height/dot_block_height:** Btc/Eth/Dot block height
- **eth_contract_events_count{ event, alias }:** The number of events from the specified contract
- **eth_balance{ address, alias }:** The ETH balance of the specified address
- **dot_agg_key_balance{}:** The balance of the aggKey in Dot
