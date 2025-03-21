import { ethers } from 'ethers';
import VaultABI from '../abi/Vault.json';
import KeyManagerABI from '../abi/KeyManager.json';
import { Logger } from 'winston';
import { ArbConfig } from '../config/interfaces';
import { Context } from '../lib/interfaces';
import promClient from 'prom-client';
import { countContractEvents, gaugeBlockHeight, gaugeEthBalance } from '../metrics/arb';
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
let wsProvider: ethers.providers.WebSocketProvider;
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
        loggerCopy.error(`Error opening ARB ws connection: ${err}`);
        loggerCopy.info(`ARB retrying in 15s`);
        await wsProvider?.destroy();
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
    const config = context.config as ArbConfig;
    try {
        if (mainRegistry.getSingleMetric(metricName) === undefined)
            mainRegistry.registerMetric(metric);
        if (mainRegistry.getSingleMetric(metricFailureName) === undefined)
            mainRegistry.registerMetric(metricFailure);
        const HTTP_URL = new URL(env.ARB_HTTP_ENDPOINT);
        const httpProvider = new ethers.providers.JsonRpcProvider({
            url: HTTP_URL.origin + HTTP_URL.pathname,
            user: HTTP_URL.username,
            password: HTTP_URL.password,
        });
        wsProvider = new ethers.providers.WebSocketProvider(env.ARB_WS_ENDPOINT);
        await wsProvider.ready;
        isWatcherRunning = true;
        metric.set(0);

        wsProvider._websocket.on('close', async (err: any, origin: any) => {
            logger.error(`ARB ws connection closed ${err} ${origin}`);
            logger.info(`retrying in 5s`);
            await wsProvider?.destroy();
            isWatcherRunning = false;
            metric.set(1);
            setTimeout(() => {
                startWatcher(context); // Retry after a delay
            }, 5000); // 5s
        });

        const keyManagerContract: ethers.Contract = new ethers.Contract(
            config.contracts.find((c: any) => c.alias === 'key-manager')!.address,
            KeyManagerABI,
            wsProvider,
        );
        const vaultContract: ethers.Contract = new ethers.Contract(
            config.contracts.find((c: any) => c.alias === 'vault')!.address,
            VaultABI,
            wsProvider,
        );

        context.provider = wsProvider;
        context.httpProvider = httpProvider;
        pollEndpoint(gaugeBlockHeight, context, 6);

        wsProvider.on('block', async (blockNumber: number) => {
            if (blockNumber % 20 === 0) {
                gaugeEthBalance(context);
            }
        });

        keyManagerContract.deployed().then(() => logger.info('Key Manager contract added'));
        keyManagerContract.on('*', async (event: any) => {
            if (event?.event !== undefined) {
                await countContractEvents({
                    ...context,
                    contractAlias: 'key-manager',
                    event: event.event,
                });
            }
        });

        vaultContract.deployed().then(() => logger.info('Vault contract added'));
        vaultContract.on('*', async (event: any) => {
            if (event?.event !== undefined) {
                await countContractEvents({
                    ...context,
                    contractAlias: 'vault',
                    event: event.event,
                });
            }
        });
    } catch (e) {
        logger.error(`ARB catch: ${e}`);
        await wsProvider?.destroy();
        isWatcherRunning = false;
        metric.set(1);
        setTimeout(() => {
            startWatcher(context); // Retry after a delay
        }, 5000); // 5s
    }
}
