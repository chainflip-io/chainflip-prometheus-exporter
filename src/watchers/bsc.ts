import { ethers } from 'ethers';
import { Logger } from 'winston';
import promClient from 'prom-client';
import { BscConfig } from '../config/interfaces';
import { Context } from '../lib/interfaces';
import { gaugeBlockHeight, gaugeBnbBalance, gaugeTokenBalance } from '../metrics/bsc';
import { pollEndpoint, RPC_TIMEOUT_MS } from '../utils/utils';

const metricName: string = 'bsc_watcher_failure';
const metric: promClient.Gauge = new promClient.Gauge({
    name: metricName,
    help: 'BSC watcher failing',
    registers: [],
});
const metricFailureName: string = 'metric_scrape_failure';
const metricFailure: promClient.Gauge = new promClient.Gauge({
    name: metricFailureName,
    help: 'Metric is failing to report',
    labelNames: ['metric'],
    registers: [],
});

const ERC20_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

export function createBscProvider(endpoint: string): ethers.JsonRpcProvider {
    const HTTP_URL = new URL(endpoint);
    const fetchRequest = new ethers.FetchRequest(HTTP_URL.origin + HTTP_URL.pathname);
    fetchRequest.timeout = RPC_TIMEOUT_MS;
    if (HTTP_URL.username !== '' || HTTP_URL.password !== '') {
        fetchRequest.setCredentials(HTTP_URL.username, HTTP_URL.password);
    }

    return new ethers.JsonRpcProvider(fetchRequest, undefined, {
        staticNetwork: true,
        batchMaxCount: 1,
    });
}

export async function validateBscChainId(
    provider: Pick<ethers.JsonRpcProvider, 'getNetwork'>,
    expectedChainId: number,
): Promise<void> {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(expectedChainId)) {
        throw new Error(
            `BSC RPC chain ID mismatch: expected ${expectedChainId}, received ${network.chainId}`,
        );
    }
}

// Needed to use the logger and context when retrying after an uncaught exception.
let loggerCopy: Logger;
let mainRegistry: promClient.Registry;
let mainContext: Context;
let isWatcherRunning: boolean = false;
let isExceptionCaught: boolean = false;
let activeIntervals: Array<ReturnType<typeof setInterval>> = [];

export default async function startBscService(context: Context) {
    const { logger, registry } = context;
    logger.info('Starting BSC listeners');
    loggerCopy = logger;
    mainRegistry = registry;
    mainContext = context;
    await startWatcher(mainContext);
}

process.on('uncaughtException', async (err) => {
    if (!isExceptionCaught && !isWatcherRunning) {
        isExceptionCaught = true;
        loggerCopy.info(`BSC retrying in 15s`);
        metric.set(1);
        setTimeout(() => {
            isExceptionCaught = false;
            startWatcher(mainContext);
        }, 15000);
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
    const config = context.config as BscConfig;

    try {
        if (mainRegistry.getSingleMetric(metricName) === undefined)
            mainRegistry.registerMetric(metric);
        if (mainRegistry.getSingleMetric(metricFailureName) === undefined)
            mainRegistry.registerMetric(metricFailure);

        const httpProvider = createBscProvider(env.BSC_HTTP_ENDPOINT);
        await validateBscChainId(httpProvider, config.networkId);

        context.httpProvider = httpProvider;
        context.bscTokenContracts = config.tokens.map(({ symbol, address }) => ({
            symbol,
            address,
            contract: new ethers.Contract(address, ERC20_ABI, httpProvider),
        }));
        context.bscTokenDecimals = new Map<string, number>();

        isWatcherRunning = true;
        metric.set(0);

        activeIntervals.push(await pollEndpoint(gaugeBlockHeight, context, 6));
        activeIntervals.push(await pollEndpoint(gaugeBnbBalance, context, 60));
        activeIntervals.push(await pollEndpoint(gaugeTokenBalance, context, 60));
    } catch (error) {
        logger.error(`BSC catch: ${error}`);
        for (const interval of activeIntervals) {
            clearInterval(interval);
        }
        activeIntervals = [];
        isWatcherRunning = false;
        metric.set(1);
        setTimeout(() => {
            startWatcher(context);
        }, 5000);
    }
}
