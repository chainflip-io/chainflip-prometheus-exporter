import promClient, { Gauge, Histogram } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { ProtocolData } from '../../utils/utils';
import makeRpcRequest from '../../utils/makeRpcRequest';
import util from 'util';

const metricNameLendingPools: string = 'cf_lending_pools';
const metricLendingPools: Gauge = new promClient.Gauge({
    name: metricNameLendingPools,
    help: 'Info about the lending pools',
    registers: [],
    labelNames: ['asset', 'value'],
});

// Histogram for account ltv values (0-100 range)
// NOTE: Histograms are cumulative. Observed every 60s to prevent rapid accumulation.
const metricNameLtvRatioHistogram: string = 'cf_ltv_ratio_histogram';
const metricLtvRatioHistogram: Histogram = new promClient.Histogram({
    name: metricNameLtvRatioHistogram,
    help: 'Distribution of LTV ratios (0-100). Observed every 60s.',
    registers: [],
    buckets: [
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 81, 82, 83, 84, 85, 86,
        87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    ], // Buckets for 0-100 range
});

const metricNameAccountLtvRatio: string = 'cf_account_ltv_ratio';
const metricAccountLtvRatio: Gauge = new promClient.Gauge({
    name: metricNameAccountLtvRatio,
    help: 'Current LTV ratio (0-100) for each account.',
    registers: [],
    labelNames: ['account'],
});

const metricNameTotalLoansValue: string = 'cf_loans_value_usd';
const metricTotalLoansValue: Gauge = new promClient.Gauge({
    name: metricNameTotalLoansValue,
    help: 'Total dollar amount of all loans (sum of principal_amount * price for each loan) by asset',
    labelNames: ['asset'],
    registers: [],
});

const metricNameTotalCollateralValue: string = 'cf_collateral_value_usd';
const metricTotalCollateralValue: Gauge = new promClient.Gauge({
    name: metricNameTotalCollateralValue,
    help: 'Total dollar amount of all collateral (sum of amount * price for each collateral) by asset',
    labelNames: ['asset'],
    registers: [],
});

const metricNameTotalLoansAmount: string = 'cf_loans_amount';
const metricTotalLoansAmount: Gauge = new promClient.Gauge({
    name: metricNameTotalLoansAmount,
    help: 'Total amount of all loans (sum of principal_amount for each loan) by asset',
    labelNames: ['asset'],
    registers: [],
});

const metricNameTotalCollateralAmount: string = 'cf_collateral_amount';
const metricTotalCollateralAmount: Gauge = new promClient.Gauge({
    name: metricNameTotalCollateralAmount,
    help: 'Total amount of all collateral (sum of amount for each collateral) by asset',
    labelNames: ['asset'],
    registers: [],
});
// Track last histogram observation time to control observation frequency
let lastHistogramObservation: number = 0;
const HISTOGRAM_OBSERVATION_INTERVAL_MS = 60000; // Observe histogram every 60 seconds (adjust as needed)

// Track previously seen accounts to detect deletions and remove stale metrics
let previousAccounts: Set<string> = new Set<string>();

export const gaugeLending = async (context: Context, data: ProtocolData): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_lending')) {
        return;
    }
    const { logger, registry, metricFailure, apiLatest } = context;

    logger.debug(`Scraping ${metricNameLendingPools}`);

    if (registry.getSingleMetric(metricNameLendingPools) === undefined)
        registry.registerMetric(metricLendingPools);
    if (registry.getSingleMetric(metricNameLtvRatioHistogram) === undefined)
        registry.registerMetric(metricLtvRatioHistogram);
    if (registry.getSingleMetric(metricNameAccountLtvRatio) === undefined)
        registry.registerMetric(metricAccountLtvRatio);
    if (registry.getSingleMetric(metricNameTotalLoansValue) === undefined)
        registry.registerMetric(metricTotalLoansValue);
    if (registry.getSingleMetric(metricNameTotalCollateralValue) === undefined)
        registry.registerMetric(metricTotalCollateralValue);
    if (registry.getSingleMetric(metricNameTotalLoansAmount) === undefined)
        registry.registerMetric(metricTotalLoansAmount);
    if (registry.getSingleMetric(metricNameTotalCollateralAmount) === undefined)
        registry.registerMetric(metricTotalCollateralAmount);

    try {
        const lendingPools = await makeRpcRequest(apiLatest, 'lending_pools', context.blockHash);
        for (const pool of lendingPools) {
            metricLendingPools.labels(pool.asset.asset, 'total_amount').set(pool.total_amount);
            metricLendingPools
                .labels(pool.asset.asset, 'available_amount')
                .set(pool.available_amount);
            metricLendingPools
                .labels(pool.asset.asset, 'utilisation_rate')
                .set(pool.utilisation_rate / 10000);
            metricLendingPools
                .labels(pool.asset.asset, 'current_interest_rate')
                .set(pool.current_interest_rate / 10000);
            if (global.oraclePrices) {
                const price = global.oraclePrices.get(pool.asset.asset);
                if (price) {
                    metricLendingPools
                        .labels(pool.asset.asset, 'total_amount_usd')
                        .set(pool.total_amount * price);
                    metricLendingPools
                        .labels(pool.asset.asset, 'available_amount_usd')
                        .set(pool.available_amount * price);
                }
            }
        }

        const loanAccounts = await makeRpcRequest(apiLatest, 'loan_accounts', context.blockHash);

        const now = Date.now();
        const shouldObserveHistogram =
            now - lastHistogramObservation >= HISTOGRAM_OBSERVATION_INTERVAL_MS;

        // Track current accounts to detect deletions
        const currentAccounts = new Set<string>();
        const totalLoansValueUSD: Map<string, number> = new Map<string, number>();
        const totalCollateralValueUSD: Map<string, number> = new Map<string, number>();
        const totalLoansAmount: Map<string, number> = new Map<string, number>();
        const totalCollateralAmount: Map<string, number> = new Map<string, number>();
        for (const account of loanAccounts) {
            currentAccounts.add(account.account);

            if (account.ltv_ratio !== null) {
                // Convert LTV ratio to 0-100 scale (assuming it's in basis points or similar)
                // Adjust this calculation based on your actual LTV ratio format
                const ltv = parseFloat(account.ltv_ratio) / 10000000;

                // Always update gauge (every scrape - shows current snapshot)
                metricAccountLtvRatio.labels(account.account).set(ltv);

                // Only observe histogram periodically (prevents rapid bucket accumulation)
                if (shouldObserveHistogram) {
                    metricLtvRatioHistogram.observe(ltv);
                }
            }
            if (global.oraclePrices) {
                for (const loan of account.loans) {
                    // Calculate total loans value in USD
                    // Get asset name and lookup price (loans use "BTC", "ETH", etc.)
                    const loanAsset = loan.asset.asset;
                    const previous = totalLoansAmount.get(loanAsset) ?? 0;
                    totalLoansAmount.set(loanAsset, previous + loan.principal_amount);
                    const price = global.oraclePrices.get(loanAsset);

                    if (price) {
                        const previous = totalLoansValueUSD.get(loanAsset) ?? 0;
                        totalLoansValueUSD.set(loanAsset, previous + loan.principal_amount * price);
                    }
                }
                for (const collateral of account.collateral) {
                    const collateralAsset = collateral.asset;
                    const previous = totalCollateralAmount.get(collateralAsset) ?? 0;
                    totalCollateralAmount.set(collateralAsset, previous + collateral.amount);
                    const price = global.oraclePrices.get(collateralAsset);
                    if (price) {
                        const previous = totalCollateralValueUSD.get(collateralAsset) ?? 0;
                        totalCollateralValueUSD.set(
                            collateralAsset,
                            previous + collateral.amount * price,
                        );
                    }
                }
            }
        }

        for (const [asset, _] of global.oraclePrices) {
            metricTotalLoansValue.labels(asset).set(totalLoansValueUSD.get(asset) ?? 0);
            metricTotalLoansAmount.labels(asset).set(totalLoansAmount.get(asset) ?? 0);
        }
        for (const [asset, _] of global.oraclePrices) {
            metricTotalCollateralValue.labels(asset).set(totalCollateralValueUSD.get(asset) ?? 0);
            metricTotalCollateralAmount.labels(asset).set(totalCollateralAmount.get(asset) ?? 0);
        }

        // Remove metrics for accounts that no longer exist
        for (const accountId of previousAccounts) {
            if (!currentAccounts.has(accountId)) {
                metricAccountLtvRatio.remove(accountId);
            }
        }

        // Update previous accounts for next scrape
        previousAccounts = currentAccounts;
        // Update last observation time if we observed the histogram
        if (shouldObserveHistogram) {
            lastHistogramObservation = now;
        }

        metricFailure.labels('cf_lending').set(0);
    } catch (e) {
        logger.error(e);
        metricFailure.labels('cf_lending').set(1);
    }
};
