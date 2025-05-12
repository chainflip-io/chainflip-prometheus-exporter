import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { Axios } from 'axios';
import { env } from '../../config/getConfig';
import { ProtocolData } from '../../utils/utils';
import { SwapSDK, Chains, Assets, SwapSDKOptions, ChainflipNetworks } from '@chainflip/sdk/swap';

const metricToUsdcName: string = 'cf_price_delta_to_usdc';
const metricToUsdc: Gauge = new promClient.Gauge({
    name: metricToUsdcName,
    help: 'The current price delta from the given token and amount to USDC',
    labelNames: ['fromAsset', 'amount'],
    registers: [],
});

const metricFromUsdcName: string = 'cf_price_delta_from_usdc';
const metricFromUsdc: Gauge = new promClient.Gauge({
    name: metricFromUsdcName,
    help: 'The current price delta from a given amount of USDC to the given token',
    labelNames: ['toAsset', 'amount'],
    registers: [],
});

const metricPriceDeltaNotWorkingName: string = 'cf_quote_unavailable';
const metricPriceDeltaNotWorking: Gauge = new promClient.Gauge({
    name: metricPriceDeltaNotWorkingName,
    help: "If == to 1 means we don't have a quote for the given pair and amount",
    labelNames: ['fromAsset', 'toAsset', 'amount'],
    registers: [],
});

const axios = new Axios({
    baseURL: env.CACHE_ENDPOINT,
    timeout: 6000,
    headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
    },
});

const BTCPriceId = 'btc0x0000000000000000000000000000000000000000';
const ETHPriceId = 'evm-10x0000000000000000000000000000000000000000';
const FLIPPriceId = 'evm-10x826180541412D574cf1336d22c0C0a287822678A';
const USDCPriceId = 'evm-10xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const DOTPriceId = 'dot0x0000000000000000000000000000000000000000';
const USDTPriceId = 'evm-10xdAC17F958D2ee523a2206206994597C13D831ec7';
const SOLPriceId = 'sol0x0000000000000000000000000000000000000000';

const prices = new Map();

type tokenDecimals = {
    BTC: number;
    ETH: number;
    FLIP: number;
    USDC: number;
    DOT: number;
    USDT: number;
    ARBETH: number;
    ARBUSDC: number;
    SOL: number;
    SOLUSDC: number;
    HUBDOT: number;
    HUBUSDC: number;
    HUBUSDT: number;
};
const decimals: tokenDecimals = {
    BTC: 1e8,
    ETH: 1e18,
    FLIP: 1e18,
    USDC: 1e6,
    DOT: 1e10,
    USDT: 1e6,
    ARBETH: 1e18,
    ARBUSDC: 1e6,
    SOL: 1e9,
    SOLUSDC: 1e6,
    HUBDOT: 1e10,
    HUBUSDC: 1e6,
    HUBUSDT: 1e6,
};

type asset = {
    asset: keyof tokenDecimals;
    absoluteAsset: keyof tokenDecimals;
    priceId: string;
    chain: string;
    chainAsset: keyof tokenDecimals;
    chainAssetPriceId: string;
};
const BTC: asset = {
    asset: 'BTC',
    absoluteAsset: 'BTC',
    priceId: BTCPriceId,
    chain: 'Bitcoin',
    chainAsset: 'BTC',
    chainAssetPriceId: BTCPriceId,
};
const ETH: asset = {
    asset: 'ETH',
    absoluteAsset: 'ETH',
    priceId: ETHPriceId,
    chain: 'Ethereum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const FLIP: asset = {
    asset: 'FLIP',
    absoluteAsset: 'FLIP',
    priceId: FLIPPriceId,
    chain: 'Ethereum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const USDT: asset = {
    asset: 'USDT',
    absoluteAsset: 'USDT',
    priceId: USDTPriceId,
    chain: 'Ethereum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const DOT: asset = {
    asset: 'DOT',
    absoluteAsset: 'DOT',
    priceId: DOTPriceId,
    chain: 'Polkadot',
    chainAsset: 'DOT',
    chainAssetPriceId: DOTPriceId,
};
const ARBETH: asset = {
    asset: 'ETH',
    absoluteAsset: 'ARBETH',
    priceId: ETHPriceId,
    chain: 'Arbitrum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const ARBUSDC: asset = {
    asset: 'USDC',
    absoluteAsset: 'ARBUSDC',
    priceId: USDCPriceId,
    chain: 'Arbitrum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const SOL: asset = {
    asset: 'SOL',
    absoluteAsset: 'SOL',
    priceId: SOLPriceId,
    chain: 'Solana',
    chainAsset: 'SOL',
    chainAssetPriceId: SOLPriceId,
};
const SOLUSDC: asset = {
    asset: 'USDC',
    absoluteAsset: 'SOLUSDC',
    priceId: USDCPriceId,
    chain: 'Solana',
    chainAsset: 'SOL',
    chainAssetPriceId: SOLPriceId,
};
const HUBDOT: asset = {
    asset: 'DOT',
    absoluteAsset: 'HUBDOT',
    priceId: DOTPriceId,
    chain: 'Assethub',
    chainAsset: 'HUBDOT',
    chainAssetPriceId: DOTPriceId,
};
const HUBUSDC: asset = {
    asset: 'USDC',
    absoluteAsset: 'HUBUSDC',
    priceId: USDCPriceId,
    chain: 'Assethub',
    chainAsset: 'HUBDOT',
    chainAssetPriceId: DOTPriceId,
};
const HUBUSDT: asset = {
    asset: 'USDT',
    absoluteAsset: 'HUBUSDT',
    priceId: USDTPriceId,
    chain: 'Assethub',
    chainAsset: 'HUBDOT',
    chainAssetPriceId: DOTPriceId,
};

const pointOneBtc = '10000000';
const pointFiveBtc = '50000000';
const oneBtc = '100000000';
const fiveEth = '5000000000000000000';
const twentyEth = '20000000000000000000';
const oneKDot = '10000000000000';
const fiveKFlip = '5000000000000000000000';
const tenKFlip = '10000000000000000000000';
const tenKUsdc = '10000000000';
const fiftyKUsdc = '50000000000';
const fiftySol = '50000000000';

let swapSDK: SwapSDK | undefined;
export const gaugePriceDelta = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_price_delta')) {
        return;
    }
    const { logger, apiLatest, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricToUsdcName}, ${metricFromUsdcName}`);

    if (registry.getSingleMetric(metricToUsdcName) === undefined)
        registry.registerMetric(metricToUsdc);
    if (registry.getSingleMetric(metricFromUsdcName) === undefined)
        registry.registerMetric(metricFromUsdc);
    if (registry.getSingleMetric(metricPriceDeltaNotWorkingName) === undefined)
        registry.registerMetric(metricPriceDeltaNotWorking);

    if (swapSDK === undefined) {
        const options: SwapSDKOptions = {
            network: ChainflipNetworks.mainnet,
            enabledFeatures: {
                dca: true,
            },
        };
        swapSDK = new SwapSDK(options);
    }

    try {
        // query all index prices
        const dataPrices = await axios.post(
            env.CACHE_ENDPOINT,
            '{"query":"\\nquery GetTokenPrices($tokens: [PriceQueryInput\u0021]\u0021) {\\n  tokenPrices: getTokenPrices(input: $tokens) {\\n    chainId\\n    address\\n    usdPrice\\n    }\\n}","variables":{"tokens":[{"chainId":"btc","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0xdAC17F958D2ee523a2206206994597C13D831ec7"},{"chainId":"evm-1","address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}, {"chainId":"evm-1","address":"0x826180541412D574cf1336d22c0C0a287822678A"}, {"chainId":"dot","address":"0x0000000000000000000000000000000000000000"}, {"chainId":"sol","address":"0x0000000000000000000000000000000000000000"}, {"chainId":"sol","address":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}]}}',
        );
        const formattedData = JSON.parse(dataPrices.data).data.tokenPrices;
        formattedData.forEach((element: any) => {
            prices.set(element.chainId.toString().concat(element.address), element.usdPrice);
        });

        /// ... -> USDC
        calculateRateToUsdc(BTC, pointOneBtc);
        calculateRateToUsdc(BTC, pointFiveBtc);
        calculateRateToUsdc(BTC, oneBtc);
        calculateRateToUsdc(ETH, fiveEth);
        calculateRateToUsdc(ETH, twentyEth);
        calculateRateToUsdc(DOT, oneKDot);
        calculateRateToUsdc(FLIP, fiveKFlip);
        calculateRateToUsdc(FLIP, tenKFlip);
        calculateRateToUsdc(ARBETH, fiveEth);
        calculateRateToUsdc(ARBETH, twentyEth);
        calculateRateToUsdc(ARBUSDC, tenKUsdc);
        calculateRateToUsdc(ARBUSDC, fiftyKUsdc);
        calculateRateToUsdc(USDT, tenKUsdc);
        calculateRateToUsdc(USDT, fiftyKUsdc);
        calculateRateToUsdc(SOL, fiftySol);
        calculateRateToUsdc(HUBDOT, oneKDot);
        calculateRateToUsdc(HUBUSDC, tenKUsdc);
        calculateRateToUsdc(HUBUSDT, tenKUsdc);

        /// USDC -> ...
        calculateRateFromUsdc(BTC, tenKUsdc);
        calculateRateFromUsdc(ETH, tenKUsdc);
        calculateRateFromUsdc(FLIP, tenKUsdc);
        calculateRateFromUsdc(BTC, fiftyKUsdc);
        calculateRateFromUsdc(ETH, fiftyKUsdc);
        // calculateRateFromUsdc(FLIP, fiftyKUsdc);
        calculateRateFromUsdc(DOT, tenKUsdc);
        calculateRateFromUsdc(ARBETH, tenKUsdc);
        calculateRateFromUsdc(ARBETH, fiftyKUsdc);
        calculateRateFromUsdc(ARBUSDC, tenKUsdc);
        calculateRateFromUsdc(ARBUSDC, fiftyKUsdc);
        calculateRateFromUsdc(USDT, tenKUsdc);
        calculateRateFromUsdc(USDT, fiftyKUsdc);
        calculateRateFromUsdc(SOL, tenKUsdc);
        calculateRateFromUsdc(SOLUSDC, tenKUsdc);
        calculateRateFromUsdc(HUBDOT, tenKUsdc);
        calculateRateFromUsdc(HUBUSDC, tenKUsdc);
        calculateRateFromUsdc(HUBUSDT, tenKUsdc);
        metricFailure.labels('cf_price_delta').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('cf_price_delta').set(1);
    }

    async function calculateRateToUsdc(from: asset, amount: string) {
        const labelAmount = (Number(amount) / decimals[from.asset]).toString();
        const quoteRequest = {
            srcChain: from.chain,
            destChain: Chains.Ethereum,
            srcAsset: from.asset,
            destAsset: Assets.USDC,
            amount,
        };

        try {
            // @ts-expect-error "sdk is initialized"
            const response = await swapSDK.getQuoteV2(quoteRequest);
            let egressAmount = 0;
            for (const quote of response.quotes) {
                egressAmount = Math.max(egressAmount, Number(quote.egressAmount) / 1e6);
            }
            if (egressAmount === 0) {
                throw new Error('egressAmount is undefined');
            }
            const delta =
                (egressAmount * prices.get(USDCPriceId) * 100) /
                    (prices.get(from.priceId) * (Number(amount) / decimals[from.asset])) -
                100;
            metricToUsdc.labels(from.absoluteAsset, labelAmount).set(delta);
            metricPriceDeltaNotWorking.labels(from.absoluteAsset, 'USDC', labelAmount).set(0);
        } catch (e) {
            logger.info(
                `Failed to query cf_swap_rate: ${from.absoluteAsset}(${labelAmount}) -> USDC`,
            );
            metricPriceDeltaNotWorking.labels(from.absoluteAsset, 'USDC', labelAmount).set(1);
        }
    }

    async function calculateRateFromUsdc(to: asset, amount: string) {
        const labelAmount = Math.round(Number(amount) / decimals.USDC).toString();

        const quoteRequest = {
            srcChain: Chains.Ethereum,
            destChain: to.chain,
            srcAsset: Assets.USDC,
            destAsset: to.asset,
            amount,
        };
        try {
            // @ts-expect-error "sdk is initialized"
            const response = await swapSDK.getQuoteV2(quoteRequest);
            let egressAmount = 0;
            for (const quote of response.quotes) {
                egressAmount = Math.max(
                    egressAmount,
                    Number(quote.egressAmount) / decimals[to.asset],
                );
            }
            if (egressAmount === 0) {
                throw new Error('egressAmount is undefined');
            }
            const delta =
                (egressAmount * prices.get(to.priceId) * 100) /
                    (prices.get(USDCPriceId) * (Number(amount) / decimals.USDC)) -
                100;
            metricFromUsdc.labels(to.absoluteAsset, labelAmount).set(delta);
            metricPriceDeltaNotWorking.labels('USDC', to.absoluteAsset, labelAmount).set(0);
        } catch (e) {
            logger.info(
                `Failed to query cf_swap_rate: USDC(${labelAmount}) -> ${to.absoluteAsset}`,
            );
            metricPriceDeltaNotWorking.labels('USDC', to.absoluteAsset, labelAmount).set(1);
        }
    }
};
