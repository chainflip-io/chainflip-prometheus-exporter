import { beforeEach, describe, expect, it } from 'vitest';
import localnet from '../config/localnet.json';
import type { Config } from '../src/config/interfaces';
import { blockHeightStore } from '../src/lib/blockHeightStore';
import { createBlockLagHealthRouter } from '../src/routes/blockLagHealth';

type JsonResponse = Record<string, unknown>;
type RoutePath = '/block-lag/:chain' | '/block-lag';
type RouteHandler = (
    request: { params: Record<string, string>; query: Record<string, string> },
    response: {
        status: (status: number) => unknown;
        json: (body: JsonResponse) => unknown;
    },
) => unknown;

const configFixture = (): Config => structuredClone(localnet) as unknown as Config;

const get = (
    path: RoutePath,
    options: {
        config?: Config;
        chain?: string;
        maxLag?: string;
    } = {},
) => {
    const router = createBlockLagHealthRouter(options.config ?? configFixture());
    const routeLayer = (
        router as unknown as {
            stack: Array<{
                route?: {
                    path: string;
                    stack: Array<{ handle: RouteHandler }>;
                };
            }>;
        }
    ).stack.find((layer) => layer.route?.path === path);
    const handler = routeLayer?.route?.stack[0]?.handle;
    if (handler === undefined) {
        throw new Error(`Route ${path} was not registered`);
    }

    let status = 200;
    let body: JsonResponse | undefined;
    const response = {
        status(value: number) {
            status = value;
            return response;
        },
        json(value: JsonResponse) {
            body = value;
            return response;
        },
    };

    handler(
        {
            params: options.chain === undefined ? {} : { chain: options.chain },
            query: options.maxLag === undefined ? {} : { maxLag: options.maxLag },
        },
        response,
    );

    if (body === undefined) {
        throw new Error(`Route ${path} did not return a JSON response`);
    }
    return { status, body };
};

beforeEach(() => {
    blockHeightStore.reset();
});

describe('BSC block-lag health', () => {
    it('reports a disabled BSC watcher as healthy', () => {
        const config = configFixture();
        config.bsc.enabled = false;

        const { status, body } = get('/block-lag/:chain', { chain: 'bsc', config });

        expect(status).toBe(200);
        expect(body).toEqual({
            chain: 'bsc',
            healthy: true,
            reason: 'chain_disabled_in_config',
            trackedHeight: null,
            externalHeight: null,
            lag: null,
            maxLag: 8000,
        });
    });

    it('reports height_not_ready until both BSC heights are available', () => {
        blockHeightStore.setTracked('bsc', 1_000);

        const { status, body } = get('/block-lag/:chain', { chain: 'bsc' });

        expect(status).toBe(200);
        expect(body).toMatchObject({
            chain: 'bsc',
            healthy: true,
            reason: 'height_not_ready',
            trackedHeight: 1_000,
            externalHeight: null,
            lag: null,
            maxLag: 8000,
        });
    });

    it('is healthy at the default BSC lag boundary', () => {
        blockHeightStore.setTracked('bsc', 10_000);
        blockHeightStore.setExternal('bsc', 18_000);

        const { body } = get('/block-lag/:chain', { chain: 'bsc' });

        expect(body).toMatchObject({
            healthy: true,
            reason: 'ok',
            trackedHeight: 10_000,
            externalHeight: 18_000,
            lag: 8000,
            maxLag: 8000,
        });
    });

    it('is unhealthy above the default BSC lag', () => {
        blockHeightStore.setTracked('bsc', 10_000);
        blockHeightStore.setExternal('bsc', 18_001);

        const { body } = get('/block-lag/:chain', { chain: 'bsc' });

        expect(body).toMatchObject({
            healthy: false,
            reason: 'chainflip_height_too_old',
            lag: 8001,
            maxLag: 8000,
        });
    });

    it('applies a per-request maxLag override', () => {
        blockHeightStore.setTracked('bsc', 1_000);
        blockHeightStore.setExternal('bsc', 1_010);

        const { body } = get('/block-lag/:chain', { chain: 'bsc', maxLag: '9' });

        expect(body).toMatchObject({
            healthy: false,
            reason: 'chainflip_height_too_old',
            lag: 10,
            maxLag: 9,
        });
    });

    it('includes BSC in aggregate health', () => {
        blockHeightStore.setTracked('bsc', 1_000);
        blockHeightStore.setExternal('bsc', 9_001);

        const { status, body } = get('/block-lag');
        const results = body.results as JsonResponse[];
        const bsc = results.find((result) => result.chain === 'bsc');

        expect(status).toBe(200);
        expect(body.healthy).toBe(false);
        expect(bsc).toMatchObject({
            chain: 'bsc',
            healthy: false,
            lag: 8001,
            maxLag: 8000,
        });
    });

    it('advertises BSC as a supported chain', () => {
        const unsupported = get('/block-lag/:chain', { chain: 'not-a-chain' });
        const supported = get('/block-lag/:chain', { chain: 'BSC' });

        expect(unsupported.status).toBe(404);
        expect(unsupported.body).toMatchObject({ error: 'unsupported_chain' });
        expect(unsupported.body.supportedChains).toContain('bsc');
        expect(supported.status).toBe(200);
        expect(supported.body.chain).toBe('bsc');
    });
});
