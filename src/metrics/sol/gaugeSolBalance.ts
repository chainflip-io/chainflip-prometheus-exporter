import promClient, { Gauge } from 'prom-client';
import { Context } from '../../lib/interfaces';
import { SolConfig } from '../../config/interfaces';
import * as solanaWeb3 from '@solana/web3.js';

const metricName: string = 'sol_balance';
const metric: Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Solana balance in SOL',
    registers: [],
    labelNames: ['account', 'alias'],
});

const metricNameAggKeyBalance: string = 'sol_agg_key_balance';
const metricAggKeyBalance: Gauge = new promClient.Gauge({
    name: metricNameAggKeyBalance,
    help: 'aggKey balance in SOL',
    registers: [],
    labelNames: ['aggKey'],
});

let lastAggKey: string;

export const gaugeSolBalance = async (context: Context) => {
    if (context.config.skipMetrics.includes('sol_balance')) {
        return;
    }
    const { logger, registry, connection, metricFailure, config } = context;

    const { wallets } = config as SolConfig;

    logger.debug(`Scraping ${metricName}`);

    if (registry.getSingleMetric(metricName) === undefined) registry.registerMetric(metric);
    if (registry.getSingleMetric(metricNameAggKeyBalance) === undefined)
        registry.registerMetric(metricAggKeyBalance);

    metricFailure.labels({ metric: metricName }).set(0);

    try {
        if (global.solAggKeyAddress) {
            if (!lastAggKey) {
                lastAggKey = global.solAggKeyAddress;
            } else if (lastAggKey !== global.solAggKeyAddress) {
                metricAggKeyBalance.remove(lastAggKey.toString());
                lastAggKey = global.solAggKeyAddress;
            }

            const pubKey = new solanaWeb3.PublicKey(global.solAggKeyAddress);
            const solAccount: any = await connection.getAccountInfo(pubKey);
            if (solAccount) {
                const metricValue = Number(solAccount.lamports) / 10 ** 9;
                metricAggKeyBalance.labels(global.solAggKeyAddress).set(metricValue);
            }
        }
        for (const { alias, address } of wallets) {
            const pubKey = new solanaWeb3.PublicKey(address);
            const solAccount: any = await connection.getAccountInfo(pubKey);
            if (solAccount) {
                const solBalance = Number(solAccount.lamports) / 10 ** 9;
                metric.labels(address, alias).set(solBalance);
            }
        }
    } catch (err) {
        logger.error(err);
        metricFailure.labels({ metric: metricName }).set(1);
    }
};
