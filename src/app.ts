import express, { Express } from 'express';
import winston, { Logger } from 'winston';
import startChainflipService from './watchers/chainflip';
import startEthereumService from './watchers/ethereum';
import getConfig, { env } from './config/getConfig';
import { Config } from './config/interfaces';
import promClient from 'prom-client';
import { Context } from './lib/interfaces';
import createContext from './lib/createContext';
import loadDefaultMetrics from './lib/loadDefaultMetrics';
import startBitcoinService from './watchers/bitcoin';
import startArbitrumService from './watchers/arbitrum';
import startSolanaService from './watchers/solana';
import startAssetHubService from './watchers/assetHub';
import startTronService from './watchers/tron';
import { createBlockLagHealthRouter } from './routes/blockLagHealth';

const logger: Logger = winston.createLogger();
logger.add(
    new winston.transports.Console({
        format: winston.format.json(),
        level: 'debug',
    }),
);

const app: Express = express();
const config: Config = getConfig(logger);

const chainflipRegistry = new promClient.Registry();
chainflipRegistry.setDefaultLabels({
    chain: 'chainflip',
    network: config.flip.network,
});

const assetHubRegistry = new promClient.Registry();
assetHubRegistry.setDefaultLabels({
    chain: 'assethub',
    network: config.hub.network,
});

const ethereumRegistry = new promClient.Registry();
ethereumRegistry.setDefaultLabels({
    chain: 'ethereum',
    network: config.eth.network,
});

const bitcoinRegistry = new promClient.Registry();
bitcoinRegistry.setDefaultLabels({
    chain: 'bitcoin',
    network: config.btc.network,
});

const arbitrumRegistry = new promClient.Registry();
arbitrumRegistry.setDefaultLabels({
    chain: 'arbitrum',
    network: config.arb.network,
});

const solanaRegistry = new promClient.Registry();
solanaRegistry.setDefaultLabels({
    chain: 'solana',
    network: config.sol.network,
});

const tronRegistry = new promClient.Registry();
tronRegistry.setDefaultLabels({
    chain: 'tron',
    network: config.tron.network,
});

// Process-level Node.js metrics (heap, rss, GC duration, event-loop lag) for leak
// diagnosis. Kept on its own registry so the nodejs_*/process_* series aren't tagged
// with a per-chain label. collectDefaultMetrics registers process-global state, so it
// must be called exactly once.
const processRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: processRegistry });

app.listen(env.NETWORK_EXPORTER_PORT || 9000, () => {
    logger.info(`Network Prometheus Exporter started on port ${env.NETWORK_EXPORTER_PORT}`);

    if (config.flip.enabled) {
        const chainflipLogger: Logger = logger.child({
            chain: 'chainflip',
            network: config.flip.network,
        });
        const chainflipContext: Context = createContext(
            chainflipLogger,
            chainflipRegistry,
            env,
            config.flip,
        );
        loadDefaultMetrics(chainflipContext);
        startChainflipService(chainflipContext);
    }

    if (config.hub.enabled) {
        const assetHubLogger: Logger = logger.child({
            chain: 'assetHub',
            network: config.hub.network,
        });
        const assetHubContext: Context = createContext(
            assetHubLogger,
            assetHubRegistry,
            env,
            config.hub,
        );
        startAssetHubService(assetHubContext);
    }

    if (config.eth.enabled) {
        const ethereumLogger: Logger = logger.child({
            chain: 'ethereum',
            network: config.eth.network,
        });
        const ethereumContext: Context = createContext(
            ethereumLogger,
            ethereumRegistry,
            env,
            config.eth,
        );
        loadDefaultMetrics(ethereumContext);
        startEthereumService(ethereumContext);
    }

    if (config.btc.enabled) {
        const bitcoinLogger: Logger = logger.child({
            chain: 'bitcoin',
            network: config.btc.network,
        });
        const bitcoinContext: Context = createContext(
            bitcoinLogger,
            bitcoinRegistry,
            env,
            config.btc,
        );
        startBitcoinService(bitcoinContext);
    }

    if (config.arb.enabled) {
        const arbitrumLogger: Logger = logger.child({
            chain: 'arbitrum',
            network: config.arb.network,
        });
        const arbitrumContext: Context = createContext(
            arbitrumLogger,
            arbitrumRegistry,
            env,
            config.arb,
        );
        startArbitrumService(arbitrumContext);
    }
    if (config.sol.enabled) {
        const solanaLogger: Logger = logger.child({
            chain: 'solana',
            network: config.sol.network,
        });
        const solanaContext: Context = createContext(solanaLogger, solanaRegistry, env, config.sol);
        loadDefaultMetrics(solanaContext);
        startSolanaService(solanaContext);
    }
    if (config.tron.enabled) {
        const tronLogger: Logger = logger.child({
            chain: 'tron',
            network: config.tron.network,
        });
        const tronContext: Context = createContext(tronLogger, tronRegistry, env, config.tron);
        loadDefaultMetrics(tronContext);
        startTronService(tronContext);
    }
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', chainflipRegistry.contentType); // It doesn't matter which registry we use here
    res.end(
        (await chainflipRegistry.metrics()) +
            (await ethereumRegistry.metrics()) +
            (await bitcoinRegistry.metrics()) +
            (await arbitrumRegistry.metrics()) +
            (await solanaRegistry.metrics()) +
            (await assetHubRegistry.metrics()) +
            (await tronRegistry.metrics()) +
            (await processRegistry.metrics()),
    );
});

app.get('/health', async (req, res) => {
    res.set('Content-Type', 'application/json');
    res.end('Online');
});

app.use('/health', createBlockLagHealthRouter(config));
