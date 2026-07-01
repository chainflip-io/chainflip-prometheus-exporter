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
import { pollEndpoint, RPC_TIMEOUT_MS } from '../utils/utils';

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
let activeInterval: ReturnType<typeof setInterval> | null = null;

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
        // Explicit per-request timeout: unlike ethers v5 (which only stopped
        // waiting), v6 cancels the request and destroys the socket on timeout.
        const fetchRequest = new ethers.FetchRequest(HTTP_URL.origin + HTTP_URL.pathname);
        fetchRequest.timeout = RPC_TIMEOUT_MS;
        if (HTTP_URL.username !== '' || HTTP_URL.password !== '') {
            fetchRequest.setCredentials(HTTP_URL.username, HTTP_URL.password);
        }
        // staticNetwork: skip repeated chain-id detection; batchMaxCount 1:
        // keep one JSON-RPC call per HTTP request, as in v5
        const httpProvider = new ethers.JsonRpcProvider(fetchRequest, undefined, {
            staticNetwork: true,
            batchMaxCount: 1,
        });
        isWatcherRunning = true;
        metric.set(0);

        const flipContractConfig = config.contracts.find((c: any) => c.alias === 'flip');
        const usdcContractConfig = config.contracts.find((c: any) => c.alias === 'usdc');
        const flipContract =
            flipContractConfig !== undefined
                ? new ethers.Contract(flipContractConfig.address, FlipABI, httpProvider)
                : null;
        const usdcContract =
            usdcContractConfig !== undefined
                ? new ethers.Contract(usdcContractConfig.address, USDCABI, httpProvider)
                : null;

        context.httpProvider = httpProvider;

        activeInterval = await pollEndpoint(
            () => {
                gaugeBlockHeight(context);
                gaugeEthBalance(context);
                if (flipContract !== null) {
                    gaugeTokenBalance({ ...context, contract: flipContract }, 'FLIP');
                    gaugeFlipBalance({ ...context, contract: flipContract });
                } else {
                    logger.debug('Skipping FLIP contract metrics: missing flip contract config');
                }

                if (usdcContract !== null) {
                    gaugeTokenBalance({ ...context, contract: usdcContract }, 'USDC');
                } else {
                    logger.debug('Skipping USDC contract metrics: missing usdc contract config');
                }
            },
            context,
            12,
        );
    } catch (e) {
        logger.error(`ETH catch: ${e}`);
        if (activeInterval) {
            clearInterval(activeInterval);
            activeInterval = null;
        }
        isWatcherRunning = false;
        metric.set(1);
        setTimeout(() => {
            startWatcher(context); // Retry after a delay
        }, 5000); // 5s
    }
}
