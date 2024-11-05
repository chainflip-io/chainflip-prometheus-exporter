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

Start up the exporter against a local node:

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

## Testing with Prometheus

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

THis can be useful for alerting.

#### Disabling metrics

If you would like to disable some metrics you can simply add the metric name, which can be found inside the metric file 

I.E [price_delta](src/metrics/chainflip/gaugePriceDelta.ts)

```js
export const gaugePriceDelta = async (context: Context): Promise<void> => {
   if (context.config.skipMetrics.includes('cf_price_delta')) {
      return;
   }
    ....
}
```

Here you can check the actual value used to disable metrics, you can simply add that value to the config:
```json
{
   "skipMetrics": [
      "cf_price_delta"
   ]
}
```
We advise to keep `cf_price_delta` disabled since it is used only internally, hence you don't have access to our cache endpoint which is used to query the data for this metric.

### Current limitations

1. You must use a Bitcoin node that accepts Basic authentication. The currently used Bitcoin client does not support API
   key authentication.

## Codebase

The codebase structure is the following, inside `src`:

- `app.ts` is the entrypoint, here we inizialize a bunch of things like:
  - Default metrics
  - Prometheus registries, one for each chain we track
  - Create a server with a couple of routes:
    - `/metrics`: which exposes all the metrics in a prometheus compatible format
    - `/health`: which is used to detect if the app is up and running
  - create multiple services/watchers, one for each chain we track, each watcher is responsible to scrape a single chain and expose the relevant metrics for it


- `abi` folder which contains the ABI for the various ETH smart contract we use, these are interfaces describing what is exposed and available on each smart contract
- `config` folder containing the interfaces of the configurations for different network
- `lib` folder containing some utilities to create a context and the default metrics
- `utils` folder containing other utilities, used throughout the codebase, like function to perform rpc calls, definitions of chain types etc..
- `watcher` folder, here we have a file for every watcher, depending on the watcher we might create a subscription which is used as trigger to query for the 
new state whenever a new block is received, or in some cases we do polling (BTC which doesn't support subscriptions and SOL/ARB since they are too fast)
  - each watcher behaves differently based on the chain, usually we rely on some libraries to interact with the underlying chain
  - I.E. in the case of chainflip, we use polkaJS to create the subscription and when a new block is received we perform an RPC call which returns all the data we need to populate our metrics.
  This is possible cause we created a custom RPC on the chainflip-node responsible to expose all the data we need for monitoring.
  - For other chain this is not possible, hence all the logic to retrieve the data from the external chain is performed inside the single metrics.
- `metrics` folder, this is the most important one, it contains all the metrics we are currently scraping, divided by chain
  - Every file is reponsible for one or more metrics (depending if they are related or not) 
    - I.E. `/chainflip/gaugeBtcUtxos.ts` expose both the number of utxos available and their total balance.
  - Metrics are defined at the beginning of the file, a function is then defined and will be used by the watcher.
Inside this function there are:
    - the logic to add the metric to the register
    - the logic to scrape the necessary data (if needed)
    - the logic to expose this data as a prometheus compatible metric

### Adding new metrics

If you want to add new metrics simply create a new file inside the `metrics/<chain>/` folder.
You can copy paste the code from another metric for the same chain.

Change the names of the function and the metric/s and update the logic to scrape the value you want and expose it as a prometheus metric.

Once your metric is ready you simply need to add a call for it inside the watcher responsible for such chain\
In order to do so you need to add the metric to the `index.ts` file, and then import it inside the watcher.
