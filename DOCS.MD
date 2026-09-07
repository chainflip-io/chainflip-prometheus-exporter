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

Metrics starting with `btc_/eth_/hub_/arb_/bsc_/sol_/tron_` represent external-chain metrics coming from the prometheus exporter (values gathered from the external-chain endpoints)

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

