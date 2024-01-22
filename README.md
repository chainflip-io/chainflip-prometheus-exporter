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

### Current limitations

1. You must use a Bitcoin node that accepts Basic authentication. The currently used Bitcoin client does not support API
   key authentication.