import express, { Express } from 'express';
import winston, { Logger } from 'winston';
import startChainflipService from './watchers/chainflip';
import startEthereumService from './watchers/ethereum';
import startPolkadotService from './watchers/polkadot';
import getConfig, { env } from './config/getConfig';
import { Config, Network } from './config/interfaces';
import promClient from 'prom-client';
import { Context } from './lib/interfaces';
import createContext from './lib/createContext';
import loadDefaultMetrics from './lib/loadDefaultMetrics';
import startBitcoinService from './watchers/bitcoin';
import startArbitrumService from './watchers/arbitrum';
import startSolanaService from './watchers/solana';
import startAssetHubService from './watchers/assetHub';

type BlockLagHealthChain =
    | 'bitcoin'
    | 'ethereum'
    | 'arbitrum'
    | 'solana'
    | 'assethub'
    | 'polkadot';

type BlockLagHealthSource = {
    externalRegistry: promClient.Registry;
    externalMetricName: string;
    trackedChainLabel: BlockLagHealthChain;
    defaultMaxLag: number;
    enabled: boolean;
};

type BlockLagHealthResult = {
    chain: BlockLagHealthChain;
    healthy: boolean;
    reason: string;
    trackedHeight: number | null;
    externalHeight: number | null;
    lag: number | null;
    maxLag: number;
};

const CHAINFLIP_TRACKED_HEIGHT_METRIC = 'cf_external_chain_block_height';

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

const polkadotRegistry = new promClient.Registry();
polkadotRegistry.setDefaultLabels({
    chain: 'polkadot',
    network: config.dot.network,
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

const blockLagHealthSources: Record<BlockLagHealthChain, BlockLagHealthSource> = {
    bitcoin: {
        externalRegistry: bitcoinRegistry,
        externalMetricName: 'btc_block_height',
        trackedChainLabel: 'bitcoin',
        defaultMaxLag: 8,
        enabled: config.btc.enabled,
    },
    ethereum: {
        externalRegistry: ethereumRegistry,
        externalMetricName: 'eth_block_height',
        trackedChainLabel: 'ethereum',
        defaultMaxLag: 64,
        enabled: config.eth.enabled,
    },
    arbitrum: {
        externalRegistry: arbitrumRegistry,
        externalMetricName: 'arb_block_height',
        trackedChainLabel: 'arbitrum',
        defaultMaxLag: 120,
        enabled: config.arb.enabled,
    },
    solana: {
        externalRegistry: solanaRegistry,
        externalMetricName: 'sol_block_height',
        trackedChainLabel: 'solana',
        defaultMaxLag: 600,
        enabled: config.sol.enabled,
    },
    assethub: {
        externalRegistry: assetHubRegistry,
        externalMetricName: 'hub_block_height',
        trackedChainLabel: 'assethub',
        defaultMaxLag: 20,
        enabled: config.hub.enabled,
    },
    polkadot: {
        externalRegistry: polkadotRegistry,
        externalMetricName: 'dot_block_height',
        trackedChainLabel: 'polkadot',
        defaultMaxLag: 20,
        enabled: config.dot.enabled,
    },
};

const getMetricValue = async (
    registry: promClient.Registry,
    metricName: string,
    labels?: Record<string, string>,
): Promise<number | null> => {
    const metric = registry.getSingleMetric(metricName);
    if (metric === undefined) {
        return null;
    }

    const metricData: any = await metric.get();
    const values: any[] = metricData?.values || [];
    if (values.length === 0) {
        return null;
    }

    const selectedValue =
        labels === undefined
            ? values[0]
            : values.find((value) =>
                Object.entries(labels).every(([labelName, labelValue]) => {
                    return value?.labels?.[labelName] === labelValue;
                }),
            );

    if (selectedValue === undefined) {
        return null;
    }

    const value = Number(selectedValue.value);
    if (!Number.isFinite(value)) {
        return null;
    }

    return value;
};

const parseMaxLag = (value: unknown): number | null => {
    if (value === undefined) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
};

const isBlockLagHealthChain = (value: string): value is BlockLagHealthChain => {
    return value in blockLagHealthSources;
};

const evaluateBlockLagHealth = async (
    chain: BlockLagHealthChain,
    maxLagOverride?: number,
): Promise<BlockLagHealthResult> => {
    const source = blockLagHealthSources[chain];
    const maxLag = maxLagOverride ?? source.defaultMaxLag;

    if (!source.enabled) {
        return {
            chain,
            healthy: false,
            reason: 'chain_disabled_in_config',
            trackedHeight: null,
            externalHeight: null,
            lag: null,
            maxLag,
        };
    }

    const trackedHeight = await getMetricValue(chainflipRegistry, CHAINFLIP_TRACKED_HEIGHT_METRIC, {
        tracked_chain: source.trackedChainLabel,
    });
    const externalHeight = await getMetricValue(source.externalRegistry, source.externalMetricName);

    if (trackedHeight === null || externalHeight === null) {
        return {
            chain,
            healthy: false,
            reason: 'metric_not_ready',
            trackedHeight,
            externalHeight,
            lag: null,
            maxLag,
        };
    }

    const lag = Math.max(0, externalHeight - trackedHeight);
    const healthy = lag <= maxLag;

    return {
        chain,
        healthy,
        reason: healthy ? 'ok' : 'chainflip_height_too_old',
        trackedHeight,
        externalHeight,
        lag,
        maxLag,
    };
};

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

    if (config.dot.enabled) {
        const polkadotLogger: Logger = logger.child({
            chain: 'polkadot',
            network: config.dot.network,
        });
        const polkadotContext: Context = createContext(
            polkadotLogger,
            polkadotRegistry,
            env,
            config.dot,
        );
        startPolkadotService(polkadotContext);
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
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', chainflipRegistry.contentType); // It doesn't matter which registry we use here
    res.end(
        (await chainflipRegistry.metrics()) +
        (await ethereumRegistry.metrics()) +
        (await polkadotRegistry.metrics()) +
        (await bitcoinRegistry.metrics()) +
        (await arbitrumRegistry.metrics()) +
        (await solanaRegistry.metrics()) +
        (await assetHubRegistry.metrics()),
    );
});

app.get('/health', async (req, res) => {
    res.set('Content-Type', 'application/json');
    res.end('Online');
});

app.get('/health/block-lag/:chain', async (req, res) => {
    const chainParam = String(req.params.chain || '').toLowerCase();
    if (!isBlockLagHealthChain(chainParam)) {
        return res.status(404).json({
            error: 'unsupported_chain',
            supportedChains: Object.keys(blockLagHealthSources),
        });
    }

    const hasMaxLag = req.query.maxLag !== undefined;
    const parsedMaxLag = parseMaxLag(req.query.maxLag);
    if (hasMaxLag && parsedMaxLag === null) {
        return res.status(400).json({
            error: 'invalid_maxLag',
            details: 'maxLag must be a non-negative number',
        });
    }

    const result = await evaluateBlockLagHealth(chainParam, parsedMaxLag ?? undefined);
    return res.status(result.healthy ? 200 : 500).json(result);
});

app.get('/health/block-lag', async (req, res) => {
    const hasMaxLag = req.query.maxLag !== undefined;
    const parsedMaxLag = parseMaxLag(req.query.maxLag);
    if (hasMaxLag && parsedMaxLag === null) {
        return res.status(400).json({
            error: 'invalid_maxLag',
            details: 'maxLag must be a non-negative number',
        });
    }

    const chains = Object.keys(blockLagHealthSources) as BlockLagHealthChain[];
    const results = await Promise.all(
        chains.map((chain) => evaluateBlockLagHealth(chain, parsedMaxLag ?? undefined)),
    );

    const healthy = results.every((result) => result.healthy);
    return res.status(healthy ? 200 : 500).json({
        healthy,
        maxLagOverride: parsedMaxLag ?? null,
        results,
    });
});
