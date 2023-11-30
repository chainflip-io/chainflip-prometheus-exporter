# Chainflip Prometheus Exporter

Prometheus exporter to retrieve important data for our monitoring and alerting system.
Designed to retrieve data from several APIs on multiple chains.

## Deploying on Kubernetes

```shell
helm repo add chainflip https://chainflip-io.github.io/chainflip-helm-charts
helm install chainflip-prometheus-exporter chainflip/chainflip-prometheus-exporter
```

This will deploy the exporter pointing at the Berghain mainnet public RPC. You will need to manually add configuration
and secrets for other networks. You can see a full example config [here](config/local.json). Required environment
variables can be found
in [.env.example](.env.example).

## Contributing

### Getting started

Install dependencies:

```shell
pnpm install
```

Copy the env file:

```shell
cp .env.example .env
```

Start up the exporter against a perseverance node:

```shell
pnpm start:dev:local
```

You can also run the exporter against a testnet:

```shell
pnpm start:dev:sisyphos
pnpm start:dev:perseverance
```

In a new terminal run:

```shell
pnpm metrics
```

This will display the metrics in the terminal.

### Custom config file

Check out the config file in `config/local.json`. This can be modified to point at different chains and networks. You
can update the tracked wallets and Chainflip accounts.

#### Enable/disable chain metrics

You can enable or disable tracking for any of the chains at your leisure.

```json
    {
    "eth": {
	  "enabled": true
    },
    "dot": {
	  "enabled": true
    },
    "btc": {
	  "enabled": true
    },
    "flip": {
	  "enabled": true
    }
}
``` 

#### Adding your validator

Update `flip.accounts` with your validator address and alias. This will add metrics for your validator.

```json
{
    "flip": {
	  "accounts": [
		{
		    "alias": "MY_NODE_ALIAS",
		    "ss58Adress": "cFNzzoURRFHx2fw2EmsCvTc7hBFP34EaP2B23oUcFdbp1FMvx"
		}
	  ]
    }
}
```

#### Setting default metrics

If you would like to expose some constants to Prometheus, you can add them to `defaultMetrics` in the config file. These
will be exposed as a gauge.

```json
{
    "defaultMetrics": {
	  "cf_expected_rotation_duration_blocks": 2400
    }
}
```

THis can be useful for alerting.

### Current limitations

1. You must use a Bitcoin node that accepts Basic authentication. The currently used Bitcoin client does not support API
   key authentication.

### Example metrics

```text
# HELP cf_authorities_warning_threshold_count Default metric
# TYPE cf_authorities_warning_threshold_count gauge
cf_authorities_warning_threshold_count{chain="chainflip",network="perseverance"} 140

# HELP cf_authorities_critical_threshold_count Default metric
# TYPE cf_authorities_critical_threshold_count gauge
cf_authorities_critical_threshold_count{chain="chainflip",network="perseverance"} 120

# HELP cf_backup_authorities_warning_threshold_count Default metric
# TYPE cf_backup_authorities_warning_threshold_count gauge
cf_backup_authorities_warning_threshold_count{chain="chainflip",network="perseverance"} 40

# HELP cf_backup_authorities_critical_threshold_count Default metric
# TYPE cf_backup_authorities_critical_threshold_count gauge
cf_backup_authorities_critical_threshold_count{chain="chainflip",network="perseverance"} 25

# HELP cf_expected_rotation_duration_blocks Default metric
# TYPE cf_expected_rotation_duration_blocks gauge
cf_expected_rotation_duration_blocks{chain="chainflip",network="perseverance"} 2400

# HELP cf_watcher_failure Chainflip watcher failing
# TYPE cf_watcher_failure gauge
cf_watcher_failure{chain="chainflip",network="perseverance"} 0

# HELP metric_scrape_failure Metric is failing to report
# TYPE metric_scrape_failure gauge
metric_scrape_failure{metric="cf_btc_utxo_balance",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_rotating",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_authorities",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_current_epoch_duration_blocks",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_block_per_epoch",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_suspended_validators_keygen_failed",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_flip_total_supply",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="gaugeRotationDuration",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_dot_block_time",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_dot_not_updating",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_eth_block_time",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_eth_not_updating",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_btc_block_time",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_btc_not_updating",chain="chainflip",network="perseverance"} 0
metric_scrape_failure{metric="cf_backup_validator",chain="chainflip",network="perseverance"} 0

# HELP cf_btc_utxo_balance Aggregated amounts from Bitcoin utxos
# TYPE cf_btc_utxo_balance gauge
cf_btc_utxo_balance{chain="chainflip",network="perseverance"} 148482385

# HELP cf_block_height Chainflip network block height
# TYPE cf_block_height gauge
cf_block_height{chain="chainflip",network="perseverance"} 911720

# HELP cf_rotating Is the Network in a rotation
# TYPE cf_rotating gauge
cf_rotating{chain="chainflip",network="perseverance"} 0

# HELP cf_events_count_total Count of extrinsics on chain
# TYPE cf_events_count_total counter
cf_events_count_total{event="polkadotChainTracking:ChainStateUpdated",chain="chainflip",network="perseverance"} 4
cf_events_count_total{event="ethereumChainTracking:ChainStateUpdated",chain="chainflip",network="perseverance"} 2

# HELP cf_broadcast_timeout_count Count of the broadcastTimeout events, grouped by broadcastId
# TYPE cf_broadcast_timeout_count gauge

# HELP cf_node_slashed Number of time ss58 has been slashed
# TYPE cf_node_slashed counter

# HELP cf_authorities The number of validator in the active set
# TYPE cf_authorities gauge
cf_authorities{chain="chainflip",network="perseverance"} 137

# HELP cf_authorities_online The number of validator in the active set who are online
# TYPE cf_authorities_online gauge
cf_authorities_online{chain="chainflip",network="perseverance"} 137

# HELP cf_current_epoch_duration_blocks How long has the current epoch lasted
# TYPE cf_current_epoch_duration_blocks gauge
cf_current_epoch_duration_blocks{chain="chainflip",network="perseverance"} 2043

# HELP cf_block_per_epoch Number of blocks between each epoch
# TYPE cf_block_per_epoch gauge
cf_block_per_epoch{chain="chainflip",network="perseverance"} 3600

# HELP cf_suspended_validators_keygen_failed The number of validators in a particular set that have been suspended due to failing keygen
# TYPE cf_suspended_validators_keygen_failed gauge
cf_suspended_validators_keygen_failed{chain="chainflip",network="perseverance"} 10

# HELP cf_flip_total_supply The total number of flip issued
# TYPE cf_flip_total_supply gauge
cf_flip_total_supply{chain="chainflip",network="perseverance"} 90016191.10567454

# HELP cf_rotation_duration The duration of a rotation in blocks
# TYPE cf_rotation_duration gauge
cf_rotation_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_keygen_in_progress_duration The duration of a RotationPhase keygensInProgress in blocks
# TYPE cf_keygen_in_progress_duration gauge
cf_keygen_in_progress_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_key_handover_in_progress_duration The duration of a RotationPhase keyHandoversInProgress in blocks
# TYPE cf_key_handover_in_progress_duration gauge
cf_key_handover_in_progress_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_activating_keys_duration The duration of a RotationPhase activatingKeys in blocks
# TYPE cf_activating_keys_duration gauge
cf_activating_keys_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_new_keys_activated_duration The duration of a RotationPhase newKeysActivated in blocks
# TYPE cf_new_keys_activated_duration gauge
cf_new_keys_activated_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_session_rotating_duration The duration of a RotationPhase sessionRotating in blocks
# TYPE cf_session_rotating_duration gauge
cf_session_rotating_duration{chain="chainflip",network="perseverance"} 0

# HELP cf_rotating_phase Is the Network in a rotation
# TYPE cf_rotating_phase gauge

# HELP cf_dot_block_time Polkadot block time in ms through the chainflip blockchain
# TYPE cf_dot_block_time gauge
cf_dot_block_time{chain="chainflip",network="perseverance"} 6000

# HELP cf_dot_not_updating Polkadot block height not updating
# TYPE cf_dot_not_updating gauge
cf_dot_not_updating{chain="chainflip",network="perseverance"} 0

# HELP cf_eth_block_time Ethereum block time in ms through the chainflip blockchain
# TYPE cf_eth_block_time gauge
cf_eth_block_time{chain="chainflip",network="perseverance"} Nan

# HELP cf_eth_not_updating Ethereum block height not updating
# TYPE cf_eth_not_updating gauge
cf_eth_not_updating{chain="chainflip",network="perseverance"} 0

# HELP cf_btc_block_time Bitcoin block time in ms through the chainflip blockchain
# TYPE cf_btc_block_time gauge
cf_btc_block_time{chain="chainflip",network="perseverance"} Nan

# HELP cf_btc_not_updating Bitcoin block height not updating
# TYPE cf_btc_not_updating gauge
cf_btc_not_updating{chain="chainflip",network="perseverance"} 0

# HELP cf_backup_validator The number of validator in the backup set
# TYPE cf_backup_validator gauge
cf_backup_validator{chain="chainflip",network="perseverance"} 0

# HELP cf_backup_validator_online The number of validator in the backup set who are online
# TYPE cf_backup_validator_online gauge
cf_backup_validator_online{chain="chainflip",network="perseverance"} 0
# HELP eth_watcher_failure Ethereum watcher failing
# TYPE eth_watcher_failure gauge
eth_watcher_failure{chain="ethereum",network="gorli"} 0

# HELP metric_scrape_failure Metric is failing to report
# TYPE metric_scrape_failure gauge
metric_scrape_failure{metric="eth_balance",chain="ethereum",network="gorli"} 0
metric_scrape_failure{metric="eth_token_balance",chain="ethereum",network="gorli"} 0
metric_scrape_failure{metric="eth_block_time",chain="ethereum",network="gorli"} 0

# HELP eth_balance The current balance of ETH in the wallet
# TYPE eth_balance gauge
eth_balance{address="0xa56A6be23b6Cf39D9448FF6e897C29c41c8fbDFF",alias="deployer",chain="ethereum",network="gorli"} 688.1563707444452
eth_balance{address="0x58f63aa23974665ecf2b08b7c0b72e4286aa822b",alias="bashful",chain="ethereum",network="gorli"} 6.41492864875168
eth_balance{address="0x93bba670696Ad5412c9d40d0326b1Fa608FE02B3",alias="doc",chain="ethereum",network="gorli"} 9.925308639513357
eth_balance{address="0x8A64ac13B9C271CDe34fA1a540CeF0a12Ed340f2",alias="dopey",chain="ethereum",network="gorli"} 10.15993224727651
eth_balance{address="0xF1B061aCCDAa4B7c029128b49aBc047F89D5CB8d",alias="vault",chain="ethereum",network="gorli"} 0

# HELP eth_token_balance The token balance of an address
# TYPE eth_token_balance gauge
eth_token_balance{symbol="FLIP",address="0xa56A6be23b6Cf39D9448FF6e897C29c41c8fbDFF",alias="deployer",contract="0x1194C91d47Fc1b65bE18db38380B5344682b67db",chain="ethereum",network="gorli"} 61557036.942098156
eth_token_balance{symbol="FLIP",address="0x58f63aa23974665ecf2b08b7c0b72e4286aa822b",alias="bashful",contract="0x1194C91d47Fc1b65bE18db38380B5344682b67db",chain="ethereum",network="gorli"} 1870.0050710301034
eth_token_balance{symbol="FLIP",address="0x93bba670696Ad5412c9d40d0326b1Fa608FE02B3",alias="doc",contract="0x1194C91d47Fc1b65bE18db38380B5344682b67db",chain="ethereum",network="gorli"} 7000
eth_token_balance{symbol="FLIP",address="0x8A64ac13B9C271CDe34fA1a540CeF0a12Ed340f2",alias="dopey",contract="0x1194C91d47Fc1b65bE18db38380B5344682b67db",chain="ethereum",network="gorli"} 0
eth_token_balance{symbol="FLIP",address="0xF1B061aCCDAa4B7c029128b49aBc047F89D5CB8d",alias="vault",contract="0x1194C91d47Fc1b65bE18db38380B5344682b67db",chain="ethereum",network="gorli"} 0
eth_token_balance{symbol="USDC",address="0xa56A6be23b6Cf39D9448FF6e897C29c41c8fbDFF",alias="deployer",contract="0x07865c6e87b9f70255377e024ace6630c1eaa37f",chain="ethereum",network="gorli"} 1e-18
eth_token_balance{symbol="USDC",address="0x58f63aa23974665ecf2b08b7c0b72e4286aa822b",alias="bashful",contract="0x07865c6e87b9f70255377e024ace6630c1eaa37f",chain="ethereum",network="gorli"} 0
eth_token_balance{symbol="USDC",address="0x93bba670696Ad5412c9d40d0326b1Fa608FE02B3",alias="doc",contract="0x07865c6e87b9f70255377e024ace6630c1eaa37f",chain="ethereum",network="gorli"} 0
eth_token_balance{symbol="USDC",address="0x8A64ac13B9C271CDe34fA1a540CeF0a12Ed340f2",alias="dopey",contract="0x07865c6e87b9f70255377e024ace6630c1eaa37f",chain="ethereum",network="gorli"} 0
eth_token_balance{symbol="USDC",address="0xF1B061aCCDAa4B7c029128b49aBc047F89D5CB8d",alias="vault",contract="0x07865c6e87b9f70255377e024ace6630c1eaa37f",chain="ethereum",network="gorli"} 9.8338227e-11

# HELP eth_block_height Ethereum network block height
# TYPE eth_block_height gauge
eth_block_height{chain="ethereum",network="gorli"} 9980129

# HELP eth_block_time Ethereum block time in ms
# TYPE eth_block_time gauge
eth_block_time{chain="ethereum",network="gorli"} 12000

# HELP eth_reorg_size Ethereum reorganization size in blocks
# TYPE eth_reorg_size gauge
eth_reorg_size{chain="ethereum",network="gorli"} 0
# HELP dot_watcher_failure Polkadot watcher failing
# TYPE dot_watcher_failure gauge
dot_watcher_failure{chain="polkadot",network="pdot"} 0

# HELP metric_scrape_failure Metric is failing to report
# TYPE metric_scrape_failure gauge
metric_scrape_failure{metric="dot_block_time",chain="polkadot",network="pdot"} 0
metric_scrape_failure{metric="dot_balance",chain="polkadot",network="pdot"} 0

# HELP dot_block_height Chainflip network block height
# TYPE dot_block_height gauge
dot_block_height{chain="polkadot",network="pdot"} 941302

# HELP dot_block_time Polkadot block time in ms
# TYPE dot_block_time gauge
dot_block_time{chain="polkadot",network="pdot"} 6000

# HELP dot_balance Polakdot balance in DOT
# TYPE dot_balance gauge
dot_balance{chain="polkadot",network="pdot"} 0

# HELP metric_scrape_failure Metric is failing to report
# TYPE metric_scrape_failure gauge
metric_scrape_failure{metric="github_repo_release",repo="go-ethereum",chain="github"} 0
metric_scrape_failure{metric="github_repo_release",repo="bitcoin",chain="github"} 0
metric_scrape_failure{metric="github_repo_release",repo="polkadot",chain="github"} 0

# HELP github_repo_release Number or releases for a given repo
# TYPE github_repo_release gauge
github_repo_release{repo="go-ethereum",chain="github"} 180
github_repo_release{repo="bitcoin",chain="github"} 45
github_repo_release{repo="polkadot",chain="github"} 137
```