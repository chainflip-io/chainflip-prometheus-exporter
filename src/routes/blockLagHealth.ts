import { Router } from 'express';
import { Config } from '../config/interfaces';
import { blockHeightStore, BlockLagChain } from '../lib/blockHeightStore';

type BlockLagSource = { enabled: boolean; defaultMaxLag: number };

type BlockLagHealthResult = {
    chain: BlockLagChain;
    healthy: boolean;
    reason: string;
    trackedHeight: number | null;
    externalHeight: number | null;
    lag: number | null;
    maxLag: number;
};

const sourcesFor = (config: Config): Record<BlockLagChain, BlockLagSource> => ({
    bitcoin: { enabled: config.btc.enabled, defaultMaxLag: 8 },
    ethereum: { enabled: config.eth.enabled, defaultMaxLag: 64 },
    arbitrum: { enabled: config.arb.enabled, defaultMaxLag: 120 },
    solana: { enabled: config.sol.enabled, defaultMaxLag: 600 },
    assethub: { enabled: config.hub.enabled, defaultMaxLag: 20 },
});

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

const evaluate = (
    chain: BlockLagChain,
    source: BlockLagSource,
    maxLagOverride?: number,
): BlockLagHealthResult => {
    const maxLag = maxLagOverride ?? source.defaultMaxLag;

    if (!source.enabled) {
        return {
            chain,
            healthy: true,
            reason: 'chain_disabled_in_config',
            trackedHeight: null,
            externalHeight: null,
            lag: null,
            maxLag,
        };
    }

    const tracked = blockHeightStore.getTracked(chain);
    const external = blockHeightStore.getExternal(chain);

    if (tracked === null || external === null) {
        return {
            chain,
            healthy: true,
            reason: 'height_not_ready',
            trackedHeight: tracked,
            externalHeight: external,
            lag: null,
            maxLag,
        };
    }

    const lag = Math.max(0, external - tracked);
    const healthy = lag <= maxLag;

    return {
        chain,
        healthy,
        reason: healthy ? 'ok' : 'chainflip_height_too_old',
        trackedHeight: tracked,
        externalHeight: external,
        lag,
        maxLag,
    };
};

export const createBlockLagHealthRouter = (config: Config): Router => {
    const router = Router();
    const sources = sourcesFor(config);

    router.get('/block-lag/:chain', (req, res) => {
        const chainParam = String(req.params.chain || '').toLowerCase();
        if (!blockHeightStore.isChain(chainParam)) {
            return res.status(404).json({
                error: 'unsupported_chain',
                supportedChains: blockHeightStore.chains(),
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

        const result = evaluate(chainParam, sources[chainParam], parsedMaxLag ?? undefined);
        return res.status(result.healthy ? 200 : 500).json(result);
    });

    router.get('/block-lag', (req, res) => {
        const hasMaxLag = req.query.maxLag !== undefined;
        const parsedMaxLag = parseMaxLag(req.query.maxLag);
        if (hasMaxLag && parsedMaxLag === null) {
            return res.status(400).json({
                error: 'invalid_maxLag',
                details: 'maxLag must be a non-negative number',
            });
        }

        const results = blockHeightStore
            .chains()
            .map((chain) => evaluate(chain, sources[chain], parsedMaxLag ?? undefined));

        const healthy = results.every((r) => r.healthy);
        return res.status(healthy ? 200 : 500).json({
            healthy,
            maxLagOverride: parsedMaxLag ?? null,
            results,
        });
    });

    return router;
};
