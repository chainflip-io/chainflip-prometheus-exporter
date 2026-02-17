import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import makeRpcRequest from '../../utils/makeRpcRequest';
import { FlipConfig } from '../../config/interfaces';
import { ProtocolData } from '../../utils/utils';

const metricNameOraclePrices: string = 'cf_oracle_price';
const metricOraclePrices: Gauge = new promClient.Gauge({
    name: metricNameOraclePrices,
    help: 'Price of the asset in usd',
    registers: [],
    labelNames: ['asset'],
});

const metricNameOraclePricesTimestamp: string = 'cf_oracle_price_timestamp';
const metricOraclePricesTimestamp: Gauge = new promClient.Gauge({
    name: metricNameOraclePricesTimestamp,
    help: 'Unix Timestamp of the last update of the asset price',
    registers: [],
    labelNames: ['asset', 'source'],
});

const metricNameOraclePricesBlock: string = 'cf_oracle_price_block';
const metricOraclePricesBlock: Gauge = new promClient.Gauge({
    name: metricNameOraclePricesBlock,
    help: 'Statechain block of the last update of the asset price',
    registers: [],
    labelNames: ['asset', 'source'],
});

const metricNameOraclePricesDelta: string = 'cf_oracle_price_delta';
const metricOraclePricesDelta: Gauge = new promClient.Gauge({
    name: metricNameOraclePricesDelta,
    help: 'Delta of the price of the asset in % compared to coingecko prices',
    registers: [],
    labelNames: ['asset'],
});

const metricNameOraclePricesStaleness: string = 'cf_oracle_price_staleness';
const metricOraclePricesStaleness: Gauge = new promClient.Gauge({
    name: metricNameOraclePricesStaleness,
    help: 'Is the price stale? (2 = Stale, 1 = MaybeStale, 0 = UpToDate)',
    registers: [],
    labelNames: ['asset', 'source'],
});

const decimals = {
    Btc: 8,
    Eth: 18,
    Usdc: 6,
    Usdt: 6,
    Sol: 9,
} as const;

type BaseAsset = keyof typeof decimals;

function hexPriceToPrice(
    hex_price: bigint,
    decimals_of_quote_asset: number,
    decimals_of_base_asset: number,
) {
    return (
        (Number(BigInt(hex_price)) / 2 ** 128) *
        10 ** (decimals_of_base_asset - decimals_of_quote_asset)
    );
}

export const gaugeOraclePrices = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_oracle_price')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;
    const config = context.config as FlipConfig;

    logger.debug(`Scraping ${metricNameOraclePrices}, ${metricNameOraclePricesDelta}`);

    if (registry.getSingleMetric(metricNameOraclePrices) === undefined)
        registry.registerMetric(metricOraclePrices);
    if (registry.getSingleMetric(metricNameOraclePricesDelta) === undefined)
        registry.registerMetric(metricOraclePricesDelta);
    if (registry.getSingleMetric(metricNameOraclePricesTimestamp) === undefined)
        registry.registerMetric(metricOraclePricesTimestamp);
    if (registry.getSingleMetric(metricNameOraclePricesBlock) === undefined)
        registry.registerMetric(metricOraclePricesBlock);
    if (registry.getSingleMetric(metricNameOraclePricesStaleness) === undefined)
        registry.registerMetric(metricOraclePricesStaleness);

    metricFailure.labels({ metric: metricNameOraclePrices }).set(0);
    metricFailure.labels({ metric: metricNameOraclePricesDelta }).set(0);
    metricFailure.labels({ metric: metricNameOraclePricesStaleness }).set(0);

    try {
        const result = await makeRpcRequest(apiLatest, 'oracle_prices', undefined, data.blockHash);
        for (const asset of result) {
            const baseAsset = asset.base_asset;
            if (!(baseAsset in decimals)) {
                continue;
            }
            const typedBase = baseAsset as BaseAsset;
            const price = hexPriceToPrice(asset.price, 6, decimals[typedBase]);
            metricOraclePrices.labels(asset.base_asset).set(price);

            // Store oracle prices in global object for reuse by other metrics
            if (!global.oraclePrices) {
                global.oraclePrices = new Map<string, number>();
            }
            global.oraclePrices.set(baseAsset.toUpperCase(), price);

            metricOraclePricesTimestamp
                .labels(asset.base_asset, 'PriceFeedApi')
                .set(asset.updated_at_oracle_timestamp);

            metricOraclePricesBlock
                .labels(asset.base_asset, 'PriceFeedApi')
                .set(asset.updated_at_statechain_block);

            if (global.prices) {
                const globalPrice = global.prices.get(typedBase);
                if (globalPrice && globalPrice !== 0) {
                    const delta = Number(percentageDifference(price, globalPrice).toFixed(4));
                    metricOraclePricesDelta.labels(asset.base_asset).set(delta);
                }
            }

            const api = data.blockApi;
            const unsync_state = (
                await api.query.genericElections.electoralUnsynchronisedState()
            ).toJSON();

            const arbitrumPrices: Record<
                string,
                { timestamp: number; updatedAtStatechainBlock: number; priceStatus: string }
            > = simplify(unsync_state.chainStates.arbitrum);
            const ethereumPrices: Record<
                string,
                { timestamp: number; updatedAtStatechainBlock: number; priceStatus: string }
            > = simplify(unsync_state.chainStates.ethereum);
            const latestPrices: Record<string, string> = mergeAndSelectLatest(
                unsync_state.chainStates.arbitrum,
                unsync_state.chainStates.ethereum,
            );

            for (const asset in latestPrices) {
                if (latestPrices[asset] === 'Stale') {
                    metricOraclePricesStaleness.labels(asset, 'PriceFeedApi').set(2);
                } else if (latestPrices[asset] === 'MaybeStale') {
                    metricOraclePricesStaleness.labels(asset, 'PriceFeedApi').set(1);
                } else {
                    metricOraclePricesStaleness.labels(asset, 'PriceFeedApi').set(0);
                }
            }
            for (const asset in arbitrumPrices) {
                if (arbitrumPrices[asset].priceStatus === 'Stale') {
                    metricOraclePricesStaleness.labels(asset, 'arbitrum').set(2);
                } else if (latestPrices[asset] === 'MaybeStale') {
                    metricOraclePricesStaleness.labels(asset, 'arbitrum').set(1);
                } else {
                    metricOraclePricesStaleness.labels(asset, 'arbitrum').set(0);
                }
                metricOraclePricesTimestamp
                    .labels(asset, 'arbitrum')
                    .set(arbitrumPrices[asset].timestamp);
                metricOraclePricesBlock
                    .labels(asset, 'arbitrum')
                    .set(arbitrumPrices[asset].updatedAtStatechainBlock);
            }
            for (const asset in ethereumPrices) {
                if (ethereumPrices[asset].priceStatus === 'Stale') {
                    metricOraclePricesStaleness.labels(asset, 'ethereum').set(2);
                } else if (latestPrices[asset] === 'MaybeStale') {
                    metricOraclePricesStaleness.labels(asset, 'ethereum').set(1);
                } else {
                    metricOraclePricesStaleness.labels(asset, 'ethereum').set(0);
                }
                metricOraclePricesTimestamp
                    .labels(asset, 'ethereum')
                    .set(ethereumPrices[asset].timestamp);
                metricOraclePricesBlock
                    .labels(asset, 'ethereum')
                    .set(ethereumPrices[asset].updatedAtStatechainBlock);
            }
        }
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameOraclePrices }).set(1);
        metricFailure.labels({ metric: metricNameOraclePricesDelta }).set(1);
        metricFailure.labels({ metric: metricNameOraclePricesStaleness }).set(1);
    }
};

function percentageDifference(price: number, globalPrice: number) {
    return ((price - globalPrice) / globalPrice) * 100;
}

function simplify(data: any) {
    const simplified: Record<
        string,
        { timestamp: number; updatedAtStatechainBlock: number; priceStatus: string }
    > = {};
    for (const key in data.price) {
        const asset = key.replace(/Usd$/i, ''); // remove 'Usd'
        simplified[asset] = {
            priceStatus: data.price[key].priceStatus,
            timestamp: Number(data.price[key].timestamp.median.seconds),
            updatedAtStatechainBlock: Number(data.price[key].updatedAtStatechainBlock),
        };
    }
    return simplified;
}

function mergeAndSelectLatest(data1: any, data2: any) {
    const merged: Record<string, string> = {};

    const allKeys = new Set([...Object.keys(data1.price), ...Object.keys(data2.price)]);

    for (const key of allKeys) {
        const a = data1.price[key];
        const b = data2.price[key];

        // Get timestamps safely (default to 0 if missing)
        const tsA = a?.timestamp?.median?.seconds ?? 0;
        const tsB = b?.timestamp?.median?.seconds ?? 0;

        // Pick the newer entry
        const latest = tsA >= tsB ? a : b;

        if (latest) {
            const asset = key.replace(/Usd$/i, ''); // remove 'Usd'
            merged[asset] = latest.priceStatus;
        }
    }

    return merged;
}
