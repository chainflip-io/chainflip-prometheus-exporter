import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { Axios } from 'axios';
import { env } from '../../config/getConfig';

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
    help: "If == to 1 menas we don't have a quote for the given asset and amount",
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
let ingressFees: any;
let egressFees: any;
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
export const gaugePriceDelta = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_price_delta')) {
        return;
    }
    const { logger, api, registry, metricFailure } = context;
    logger.debug(`Scraping ${metricToUsdcName}, ${metricFromUsdcName}`);

    if (registry.getSingleMetric(metricToUsdcName) === undefined)
        registry.registerMetric(metricToUsdc);
    if (registry.getSingleMetric(metricFromUsdcName) === undefined)
        registry.registerMetric(metricFromUsdc);
    if (registry.getSingleMetric(metricPriceDeltaNotWorkingName) === undefined)
        registry.registerMetric(metricPriceDeltaNotWorking);

    try {
        const pointOneBtc = 10000000;
        const pointFiveBtc = 50000000;
        const oneBtc = 100000000;
        const fiveEth = 5000000000000000000;
        const twentyEth = 20000000000000000000;
        const oneKDot = 10000000000000;
        const fiveKFlip = 5000000000000000000000;
        const tenKFlip = 10000000000000000000000;
        const tenKUsdc = 10000000000;
        const fiftyKUsdc = 50000000000;
        const fiftySol = 50000000000;

        // query all index prices
        const data = await axios.post(
            env.CACHE_ENDPOINT,
            '{"query":"\\nquery GetTokenPrices($tokens: [PriceQueryInput\u0021]\u0021) {\\n  tokenPrices: getTokenPrices(input: $tokens) {\\n    chainId\\n    address\\n    usdPrice\\n    }\\n}","variables":{"tokens":[{"chainId":"btc","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0xdAC17F958D2ee523a2206206994597C13D831ec7"},{"chainId":"evm-1","address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}, {"chainId":"evm-1","address":"0x826180541412D574cf1336d22c0C0a287822678A"}, {"chainId":"dot","address":"0x0000000000000000000000000000000000000000"}, {"chainId":"sol","address":"0x0000000000000000000000000000000000000000"}, {"chainId":"sol","address":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}]}}',
        );
        const formattedData = JSON.parse(data.data).data.tokenPrices;
        formattedData.forEach((element: any) => {
            prices.set(element.chainId.toString().concat(element.address), element.usdPrice);
        });

        // query ingress/egress fees
        const environment = await api.rpc('cf_ingress_egress_environment', context.blockHash);
        ingressFees = environment.ingress_fees;
        egressFees = environment.egress_fees;

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

        /// USDC -> ...
        calculateRateFromUsdc(BTC, tenKUsdc);
        calculateRateFromUsdc(ETH, tenKUsdc);
        calculateRateFromUsdc(FLIP, tenKUsdc);
        calculateRateFromUsdc(BTC, fiftyKUsdc);
        calculateRateFromUsdc(ETH, fiftyKUsdc);
        calculateRateFromUsdc(FLIP, fiftyKUsdc);
        calculateRateFromUsdc(DOT, tenKUsdc);
        calculateRateFromUsdc(ARBETH, tenKUsdc);
        calculateRateFromUsdc(ARBETH, fiftyKUsdc);
        calculateRateFromUsdc(ARBUSDC, tenKUsdc);
        calculateRateFromUsdc(ARBUSDC, fiftyKUsdc);
        calculateRateFromUsdc(USDT, tenKUsdc);
        calculateRateFromUsdc(USDT, fiftyKUsdc);
        calculateRateFromUsdc(SOL, tenKUsdc);
        metricFailure.labels('cf_price_delta').set(0);
    } catch (e: any) {
        logger.error(e);
        metricFailure.labels('cf_price_delta').set(0);
    }

    function calculateRateToUsdc(from: asset, intialAmount: number) {
        const labelAmount = (intialAmount / decimals[from.asset]).toString();
        // we need to subtract ingress fee before calculating the swap rate
        let netImputAmount = intialAmount - parseInt(ingressFees[from.chain][from.asset]);
        netImputAmount = Math.round(netImputAmount);
        // simulate the swap
        api.rpc(
            'cf_swap_rate',
            { chain: from.chain, asset: from.asset },
            { chain: 'Ethereum', asset: 'USDC' },
            netImputAmount.toString(16),
            context.blockHash,
        ).then(
            (output: any) => {
                const amount = output.output;
                const netEgressAmount = (parseInt(amount) - egressFees.Ethereum.USDC) / 1e6;

                const delta =
                    (netEgressAmount * prices.get(USDCPriceId) * 100) /
                        (prices.get(from.priceId) * (intialAmount / decimals[from.asset])) -
                    100;
                metricToUsdc.labels(from.absoluteAsset, labelAmount).set(delta);
                metricPriceDeltaNotWorking.labels(from.absoluteAsset, 'USDC', labelAmount).set(0);
            },
            () => {
                logger.info(
                    `Failed to query cf_swap_rate: ${from.absoluteAsset}(${labelAmount}) -> USDC`,
                );
                metricPriceDeltaNotWorking.labels(from.absoluteAsset, 'USDC', labelAmount).set(1);
            },
        );
    }

    function calculateRateFromUsdc(to: asset, intialAmount: number) {
        const labelAmount = Math.round(intialAmount / decimals.USDC).toString();
        // we need to subtract ingress fee before calculating the swap rate
        let netImputAmount = intialAmount - parseInt(ingressFees.Ethereum.USDC);
        netImputAmount = Math.round(netImputAmount);

        // simulate the swap
        api.rpc(
            'cf_swap_rate',
            { chain: 'Ethereum', asset: 'USDC' },
            { chain: to.chain, asset: to.asset },
            netImputAmount.toString(16),
            context.blockHash,
        ).then(
            (output: any) => {
                const amount = output.output;
                const netEgressAmount =
                    (parseInt(amount) - egressFees[to.chain][to.asset]) / decimals[to.asset];

                const delta =
                    (netEgressAmount * prices.get(to.priceId) * 100) /
                        (prices.get(USDCPriceId) * (intialAmount / decimals.USDC)) -
                    100;
                metricFromUsdc.labels(to.absoluteAsset, labelAmount).set(delta);
                metricPriceDeltaNotWorking.labels('USDC', to.absoluteAsset, labelAmount).set(0);
            },
            () => {
                logger.info(
                    `Failed to query cf_swap_rate: USDC(${labelAmount}) -> ${to.absoluteAsset}`,
                );
                metricPriceDeltaNotWorking.labels('USDC', to.absoluteAsset, labelAmount).set(1);
            },
        );
    }
};
