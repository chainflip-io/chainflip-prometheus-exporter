import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { Axios } from 'axios';

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
    baseURL: 'https://cache-service.chainflip.io/graphql',
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

const prices = new Map();
let ingressFees;
let egressFees;
const decimals = {
    BTC: 1e8,
    ETH: 1e18,
    FLIP: 1e18,
    USDC: 1e6,
    DOT: 1e10,
};

type asset = {
    asset: string;
    priceId: string;
    chain: string;
    chainAsset: string;
    chainAssetPriceId: string;
};
const BTC: asset = {
    asset: 'BTC',
    priceId: BTCPriceId,
    chain: 'Bitcoin',
    chainAsset: 'BTC',
    chainAssetPriceId: BTCPriceId,
};
const ETH: asset = {
    asset: 'ETH',
    priceId: ETHPriceId,
    chain: 'Ethereum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const FLIP: asset = {
    asset: 'FLIP',
    priceId: FLIPPriceId,
    chain: 'Ethereum',
    chainAsset: 'ETH',
    chainAssetPriceId: ETHPriceId,
};
const DOT: asset = {
    asset: 'DOT',
    priceId: DOTPriceId,
    chain: 'Polkadot',
    chainAsset: 'DOT',
    chainAssetPriceId: DOTPriceId,
};
export const gaugePriceDelta = async (context: Context): Promise<void> => {
    const { logger, api, registry } = context;
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

        // query all index prices
        const data = await axios.post(
            'https://cache-service.chainflip.io/graphql',
            '{"query":"\\nquery GetTokenPrices($tokens: [PriceQueryInput\u0021]\u0021) {\\n  tokenPrices: getTokenPrices(input: $tokens) {\\n    chainId\\n    address\\n    usdPrice\\n    }\\n}","variables":{"tokens":[{"chainId":"btc","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0x0000000000000000000000000000000000000000"},{"chainId":"evm-1","address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}, {"chainId":"evm-1","address":"0x826180541412D574cf1336d22c0C0a287822678A"}, {"chainId":"dot","address":"0x0000000000000000000000000000000000000000"}]}}',
        );
        const formattedData = JSON.parse(data.data).data.tokenPrices;
        formattedData.forEach((element) => {
            prices.set(element.chainId.toString().concat(element.address), element.usdPrice);
        });

        // query ingress/egress fees
        const environment = await api.rpc('cf_ingress_egress_environment');
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

        /// USDC -> ...
        calculateRateFromUsdc(BTC, tenKUsdc);
        calculateRateFromUsdc(ETH, tenKUsdc);
        calculateRateFromUsdc(FLIP, tenKUsdc);
        calculateRateFromUsdc(BTC, fiftyKUsdc);
        calculateRateFromUsdc(ETH, fiftyKUsdc);
        calculateRateFromUsdc(FLIP, fiftyKUsdc);
    } catch (e: any) {
        logger.error(e);
    }

    function calculateRateToUsdc(from: asset, intialAmount: number) {
        const labelAmount = (intialAmount / decimals[from.asset]).toString();
        let netImputAmount =
            intialAmount / decimals[from.asset] -
            ((parseInt(ingressFees[from.chain][from.asset]) / decimals[from.chainAsset]) *
                prices.get(from.chainAssetPriceId)) /
                prices.get(from.priceId);
        netImputAmount = Math.round(netImputAmount * decimals[from.asset]);

        // simulate the swap
        api.rpc('cf_swap_rate', from.asset, 'USDC', netImputAmount.toString(16)).then(
            (output) => {
                const amount = output.output;
                // we need to "simulate" the amount of fees we are paying in USDC, because it is given back in ETH
                const usdcFeeInEth = parseInt(egressFees.Ethereum.USDC);
                const usdcFee = (usdcFeeInEth / 1e18) * prices.get(ETHPriceId);
                const netEgressAmount = parseInt(amount) / 1e6 - usdcFee;

                const delta =
                    ((netEgressAmount * prices.get(USDCPriceId) -
                        prices.get(from.priceId) * (intialAmount / decimals[from.asset])) /
                        (prices.get(from.priceId) * (intialAmount / decimals[from.asset]))) *
                    100;
                metricToUsdc.labels(from.asset, labelAmount).set(delta);
                metricPriceDeltaNotWorking.labels(from.asset, 'USDC', labelAmount).set(0);
            },
            () => {
                logger.info(
                    `Failed to query cf_swap_rate: ${from.asset}(${
                        intialAmount / decimals[from.asset]
                    }) -> USDC`,
                );
                metricPriceDeltaNotWorking.labels(from.asset, 'USDC', labelAmount).set(1);
            },
        );
    }

    function calculateRateFromUsdc(to: asset, intialAmount: number) {
        const labelAmount = (intialAmount / decimals.USDC).toString();
        let netImputAmount =
            intialAmount / decimals.USDC -
            ((parseInt(ingressFees.Ethereum.USDC) / decimals.ETH) * prices.get(ETHPriceId)) /
                prices.get(USDCPriceId);
        netImputAmount = Math.round(netImputAmount * decimals.USDC);

        // simulate the swap
        api.rpc('cf_swap_rate', 'USDC', to.asset, netImputAmount.toString(16)).then(
            (output) => {
                const amount = output.output;
                const egressFee =
                    ((parseInt(egressFees[to.chain][to.chainAsset]) / decimals[to.chainAsset]) *
                        prices.get(to.chainAssetPriceId)) /
                    prices.get(to.priceId);
                const netEgressAmount = parseInt(amount) / decimals[to.asset] - egressFee;

                const delta =
                    ((netEgressAmount * prices.get(to.priceId) -
                        prices.get(USDCPriceId) * (intialAmount / decimals.USDC)) /
                        (prices.get(USDCPriceId) * (intialAmount / decimals.USDC))) *
                    100;
                metricFromUsdc.labels(to.asset, labelAmount).set(delta);
                metricPriceDeltaNotWorking.labels('USDC', to.asset, labelAmount).set(0);
            },
            () => {
                logger.info(
                    `Failed to query cf_swap_rate: USDC(${intialAmount / decimals.USDC}) -> ${
                        to.asset
                    }`,
                );
                metricPriceDeltaNotWorking.labels('USDC', to.asset, labelAmount).set(1);
            },
        );
    }
};
