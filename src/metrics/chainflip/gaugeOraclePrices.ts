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

const metricNameOraclePricesDelta: string = 'cf_oracle_price_delta';
const metricOraclePricesDelta: Gauge = new promClient.Gauge({
    name: metricNameOraclePricesDelta,
    help: 'Delta of the price of the asset in % compared to coingecko prices',
    registers: [],
    labelNames: ['asset'],
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

    metricFailure.labels({ metric: metricNameOraclePrices }).set(0);
    metricFailure.labels({ metric: metricNameOraclePricesDelta }).set(0);

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

            if (global.prices) {
                const globalPrice = global.prices.get(typedBase);
                if (globalPrice && globalPrice !== 0) {
                    const delta = Number(percentageDifference(price, globalPrice).toFixed(4));
                    metricOraclePricesDelta.labels(asset.base_asset).set(delta);
                }
            }
        }
    } catch (e) {
        logger.error(e);
        metricFailure.labels({ metric: metricNameOraclePrices }).set(1);
        metricFailure.labels({ metric: metricNameOraclePricesDelta }).set(1);
    }
};

function percentageDifference(price: number, globalPrice: number) {
    return ((price - globalPrice) / globalPrice) * 100;
}
