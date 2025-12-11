import { ethers } from 'ethers';
import FlipABI from '../abi/FLIP.json';
import USDCABI from '../abi/MockUSDC.json';
import { Logger } from 'winston';
import { EthConfig } from '../config/interfaces';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import {
    gaugeBlockHeight,
    gaugeEthBalance,
    gaugeTokenBalance,
    gaugeFlipBalance,
} from '../metrics/eth';
import { pollEndpoint } from '../utils/utils';

const metricName: string = 'eth_watcher_failure';
const metric: promClient.Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Ethereum watcher failing',
    registers: [],
});
const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

// needed to be able to use logger and config in case of uncaughtException
let loggerCopy: Logger;
let mainRegistry: promClient.Registry;
let mainContext: Context;
let isWatcherRunning: boolean = false;
let isExceptionCaught: boolean = false;

export default async function startEthereumService(context: Context) {
    const { logger, registry } = context;
    logger.info('Starting Ethereum listeners');
    loggerCopy = logger;
    mainRegistry = registry;
    mainContext = context;
    await startWatcher(mainContext);
}

process.on('uncaughtException', async (err) => {
    if (!isExceptionCaught && !isWatcherRunning) {
        isExceptionCaught = true;
        loggerCopy.info(`ETH retrying in 15s`);
        metric.set(1);
        setTimeout(() => {
            isExceptionCaught = false;
            startWatcher(mainContext); // Retry after a delay
        }, 15000); // 15s
    }
    loggerCopy.debug(`UncaughtException ${err}`);
    loggerCopy.debug(
        `isExceptionCaught: ${isExceptionCaught}, isWatcherRunning: ${isWatcherRunning}`,
    );
});

async function startWatcher(context: Context) {
    if (isWatcherRunning) {
        metric.set(0);
        return;
    }

    const { logger, env } = context;
    context = { ...context, metricFailure };
    const config = context.config as EthConfig;
    try {
        if (mainRegistry.getSingleMetric(metricName) === undefined)
            mainRegistry.registerMetric(metric);
        if (mainRegistry.getSingleMetric(metricFailureName) === undefined)
            mainRegistry.registerMetric(metricFailure);
        const HTTP_URL = new URL(env.ETH_HTTP_ENDPOINT);
        let httpProvider;
        if (env.ETH_HTTP_ENDPOINT === 'http://localhost:8545') {
            httpProvider = new ethers.providers.JsonRpcProvider(env.ETH_HTTP_ENDPOINT);
        } else {
            httpProvider = new ethers.providers.JsonRpcProvider({
                url: HTTP_URL.origin + HTTP_URL.pathname,
                user: HTTP_URL.username,
                password: HTTP_URL.password,
            });
        }
        isWatcherRunning = true;
        metric.set(0);

        const flipContract: ethers.Contract = new ethers.Contract(
            config.contracts.find((c: any) => c.alias === 'flip')!.address,
            FlipABI,
            httpProvider,
        );
        const usdcContract: ethers.Contract = new ethers.Contract(
            config.contracts.find((c: any) => c.alias === 'usdc')!.address,
            USDCABI,
            httpProvider,
        );

        context.httpProvider = httpProvider;

        pollEndpoint(
            () => {
                gaugeBlockHeight(context);
                gaugeEthBalance(context);
                gaugeTokenBalance({ ...context, contract: flipContract }, 'FLIP');
                gaugeTokenBalance({ ...context, contract: usdcContract }, 'USDC');
                gaugeFlipBalance({ ...context, contract: flipContract });
            },
            context,
            12,
        );
    } catch (e) {
        logger.error(`ETH catch: ${e}`);
        isWatcherRunning = false;
        metric.set(1);
        setTimeout(() => {
            startWatcher(context); // Retry after a delay
        }, 5000); // 5s
    }
}
