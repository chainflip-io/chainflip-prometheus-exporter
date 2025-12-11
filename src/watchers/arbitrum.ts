import { ethers } from 'ethers';
import { Logger } from 'winston';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import { gaugeBlockHeight, gaugeEthBalance } from '../metrics/arb';
import { pollEndpoint } from '../utils/utils';

const metricName: string = 'arb_watcher_failure';
const metric: promClient.Gauge = new promClient.Gauge({
    name: metricName,
    help: 'Arbitrum watcher failing',
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

export default async function startArbitrumService(context: Context) {
    const { logger, registry } = context;
    logger.info('Starting Arbitrum listeners');
    loggerCopy = logger;
    mainRegistry = registry;
    mainContext = context;
    await startWatcher(mainContext);
}

process.on('uncaughtException', async (err) => {
    if (!isExceptionCaught && !isWatcherRunning) {
        isExceptionCaught = true;
        loggerCopy.info(`ARB retrying in 15s`);
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
    try {
        if (mainRegistry.getSingleMetric(metricName) === undefined)
            mainRegistry.registerMetric(metric);
        if (mainRegistry.getSingleMetric(metricFailureName) === undefined)
            mainRegistry.registerMetric(metricFailure);
        const HTTP_URL = new URL(env.ARB_HTTP_ENDPOINT);
        let httpProvider;
        if (env.ARB_HTTP_ENDPOINT === 'http://localhost:8547') {
            httpProvider = new ethers.providers.JsonRpcProvider(env.ARB_HTTP_ENDPOINT);
        } else {
            httpProvider = new ethers.providers.JsonRpcProvider({
                url: HTTP_URL.origin + HTTP_URL.pathname,
                user: HTTP_URL.username,
                password: HTTP_URL.password,
            });
        }
        isWatcherRunning = true;
        metric.set(0);

        context.httpProvider = httpProvider;
        pollEndpoint(gaugeBlockHeight, context, 6);
        pollEndpoint(gaugeEthBalance, context, 6);
    } catch (e) {
        logger.error(`ARB catch: ${e}`);
        isWatcherRunning = false;
        metric.set(1);
        setTimeout(() => {
            startWatcher(context); // Retry after a delay
        }, 5000); // 5s
    }
}
