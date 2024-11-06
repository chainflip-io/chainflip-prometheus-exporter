# Chainflip Prometheus Exporter

Prometheus exporter to retrieve important data for our monitoring and alerting system.
Designed to retrieve data from several APIs on multiple chains.

## Deploying on Kubernetes

```shell
helm repo add chainflip https://chainflip-io.github.io/chainflip-helm-charts
helm install chainflip-prometheus-exporter chainflip/chainflip-prometheus-exporter
```

This will deploy the exporter pointing at the Berghain mainnet public RPC. You will need to manually add configuration
and secrets for other networks. You can see a full example config [here](config/berghain.json). Required environment
variables can be found in [.env.example](.env.example).

## Contributing

### Getting started

Install dependencies:

```shell
pnpm install
```

Start up the exporter against a [localnet](https://github.com/chainflip-io/chainflip-backend):

```shell
pnpm start:dev:local
```
The exporter is already configured to point to the correct local endpoints if no env file is provided.

You can also run the exporter against a testnet or mainnet:

```shell
cp .env.example .env
```
copy the env file and populate it with the correct endpoints, then run:

```shell
pnpm start:dev:sisyphos
pnpm start:dev:perseverance

pnpm start:dev:berghain
```
depending on the network you want to target.

In a new terminal run:

```shell
pnpm metrics
```

This will display the metrics in the terminal.

### Testing with Prometheus

First copy the `alerts.yaml.example` file to `alerts.yaml`:

```shell
cp alerts.yaml.example alerts.yaml
```

Then run Prometheus. It is already configured to point at the exporter:

```shell
docker-compose up -d
```

You can now access Prometheus at http://localhost:9090.

To add new alerts to Prometheus, add them to the `alerts.yaml` file. Then restart Prometheus:

```shell
docker-compose restart prometheus
```



### Custom config file

Check out the config file in `config/local.json`. This can be modified to point at different chains and networks. You
can update the tracked wallets and Chainflip accounts.

#### Enable/disable chains

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
		    "ss58Address": "cFNzzoURRFHx2fw2EmsCvTc7hBFP34EaP2B23oUcFdbp1FMvx"
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

This can be useful for alerting.


#### Disabling Unnecessary Metrics

You can disable specific metrics that you are not interested in scraping. To do this:

1. **Identify the Metric Key**:
    - Open the metric file and locate the key value used to control whether the metric is enabled. Usually, this value matches the metric name, but some files may define multiple metrics.
    - **Example**: To disable `cf_btc_utxo_balance` (from [`src/metrics/chainflip/gaugeBtcUtxos.ts`](src/metrics/chainflip/gaugeBtcUtxos.ts)), add `cf_btc_utxos` to the config, which will disable both `cf_btc_utxos` and `cf_btc_utxo_balance`.

2. **Locate the Control Statement**:
    - The metric key can typically be found at the top of the function. For instance:
      ```js
      export const gaugeBtcUtxos = async (context: Context): Promise<void> => {
          if (context.config.skipMetrics.includes('cf_btc_utxos')) {
              return;
          }
          ...
      }
      ```

3. **Update the Configuration**:
    - Add the metric key to the `skipMetrics` array in your configuration file to disable it. Example:
      ```json
      {
         "skipMetrics": [
           "cf_btc_utxos"
         ]
      }
      ```

4. **Recommended Disables**:
    - We recommend keeping `cf_price_delta` disabled, as it is used only internally. Without access to our cache endpoint, this metric errors while scraping the necessary data.

#### Current limitations

1. You must use a Bitcoin node that accepts Basic authentication. The currently used Bitcoin client does not support API
   key authentication.

   
## Codebase Structure

Within the `src` directory, the main components are organized as follows:

#### `app.ts`
- **Purpose**: The primary entry point for the application, initializing core components.
- **Initializations**:
    - Sets up default metrics.
    - Initializes Prometheus registries—one per tracked blockchain.
    - Creates a server with two main routes:
        - **`/metrics`**: Exposes all metrics in a Prometheus-compatible format.
        - **`/health`**: Provides a health check to confirm the app is running.
    - Launches multiple chain-specific services (or "watchers"), each dedicated to scraping metrics for a single chain.

#### `abi` Folder
- Contains the ABI (Application Binary Interface) definitions for the Ethereum smart contracts used. These interfaces define the available functions and events for each contract.

#### `config` Folder
- Contains configuration interfaces specific to each supported network.

#### `lib` Folder
- Contains utility functions for setting up a context and initializing default metrics.

#### `utils` Folder
- Contains shared utilities, such as functions for making RPC calls and definitions of chain-specific types.

#### `watcher` Folder
- Contains a file for each chain watcher. Each watcher is responsible for tracking a specific chain’s state and collecting relevant metrics.
    - **Behavior**: Each watcher operates according to the requirements of its respective chain:
        - Some chains support subscriptions, where the watcher is triggered on each new block.
        - For chains like BTC (which lacks subscriptions) or high-throughput chains (e.g., SOL/ARB), polling is used instead.
    - **Example**: For Chainflip, `polkaJS` is used to create subscriptions, allowing watchers to react to new blocks and fetch all the necessary data via a single custom RPC call.
    - For other chains where a single custom RPC call isn't available, metrics collection is handled individually within each watcher.

#### `metrics` Folder
- **Purpose**: Houses all defined metrics, organized by chain.
- **Structure**:
    - Each file defines one or more metrics related to a specific chain.
        - **Example**: `/chainflip/gaugeBtcUtxos.ts` defines both the count of BTC UTXOs and their total balance.
    - **Functionality**: Each metric file contains:
        - Metric definitions.
        - Functions for registering and exposing each metric in a Prometheus-compatible format.
        - The data scraping logic needed to populate each metric.

    
### Adding New Metrics

To add new metrics, follow these steps:

1. **Create a New File**:
    - Inside the `metrics/<chain>/` folder, create a new file for the metric.
    - You can copy the code from an existing metric file for the same chain as a template.

2. **Modify Function Names and Logic**:
    - Update the function and metric names to reflect the new metric.
    - Adjust the logic to scrape the desired values and expose them as Prometheus-compatible metrics.

3. **Integrate the Metric with the Watcher**:
    - Once your metric is defined, add a call to it within the watcher responsible for that chain.
    - To do this, add the new metric to the `index.ts` file in the `metrics/<chain>/` folder.
    - Finally, import the metric into the watcher to complete the integration.
