import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Registry } from 'prom-client';
import { Logger } from 'winston';
import { Context } from '../src/lib/interfaces';
import { countEvents, gaugeBalance, gaugeBlockHeight } from '../src/metrics/assetHub';
import startAssetHubService from '../src/watchers/assetHub';

vi.mock('@polkadot/api', () => ({ ApiPromise: vi.fn(), WsProvider: vi.fn() }));
vi.mock('../src/metrics/assetHub');

function makeAttempt() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const api = {
        isReadyOrError: new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        }),
        on: vi.fn(),
        disconnect: vi.fn().mockResolvedValue(undefined),
    };
    return { api, resolve, reject };
}

describe('AssetHub watcher recovery', () => {
    let attempts: ReturnType<typeof makeAttempt>[];
    let providers: { on: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[];
    let registry: Registry;
    let context: Context;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();
        attempts = [];
        providers = [];
        registry = new Registry();
        context = {
            logger: { info: vi.fn(), error: vi.fn() } as unknown as Logger,
            registry,
            env: { HUB_WS_ENDPOINT: 'wss://rpc.example.test' },
            config: {
                enabled: true,
                network: 'assethub',
                skipMetrics: [],
                defaultMetrics: [],
                accounts: [],
            },
        };
        vi.mocked(WsProvider).mockImplementation(function () {
            const provider = {
                on: vi.fn(),
                disconnect: vi.fn().mockResolvedValue(undefined),
            };
            providers.push(provider);
            return provider as unknown as WsProvider;
        });
        vi.mocked(ApiPromise).mockImplementation(function () {
            const attempt = makeAttempt();
            attempts.push(attempt);
            return attempt.api as unknown as ApiPromise;
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    async function ready(index: number) {
        attempts[index].resolve();
        await vi.advanceTimersByTimeAsync(0);
    }

    function emit(index: number, event: string) {
        const [, callback] = providers[index].on.mock.calls.find(([name]) => name === event)!;
        callback(new Error('RPC unavailable'));
    }

    async function failure() {
        return (await registry.getSingleMetric('hub_watcher_failure')!.get()).values[0].value;
    }

    it.each(['disconnected', 'error'])(
        'reconnects on %s, clears old polling timers, and ignores old provider events',
        async (event) => {
            await startAssetHubService(context);
            await ready(0);
            await vi.advanceTimersByTimeAsync(6_000);
            expect(await failure()).toBe(0);

            emit(0, event);
            await vi.advanceTimersByTimeAsync(0);
            expect(attempts[0].api.disconnect).toHaveBeenCalledOnce();
            expect(await failure()).toBe(1);
            expect(vi.getTimerCount()).toBe(1); // Only the retry timer remains.

            await vi.advanceTimersByTimeAsync(5_000);
            await ready(1);
            emit(0, 'error');
            await vi.advanceTimersByTimeAsync(12_000);

            expect(await failure()).toBe(0);
            expect(attempts).toHaveLength(2);
            expect(
                vi
                    .mocked(gaugeBlockHeight)
                    .mock.calls.filter(([ctx]) => ctx.api === attempts[0].api),
            ).toHaveLength(2);
            expect(
                vi
                    .mocked(gaugeBlockHeight)
                    .mock.calls.filter(([ctx]) => ctx.api === attempts[1].api),
            ).toHaveLength(3);
            expect(gaugeBalance).toHaveBeenCalledTimes(5);
            expect(countEvents).toHaveBeenCalledTimes(2);
            expect(vi.getTimerCount()).toBe(3);
        },
    );

    it('times out startup and never starts polling if the old API becomes ready later', async () => {
        await startAssetHubService(context);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(attempts[0].api.disconnect).toHaveBeenCalledOnce();
        expect(gaugeBlockHeight).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5_000);
        await ready(1);
        await ready(0);

        expect(gaugeBlockHeight).toHaveBeenCalledOnce();
        expect(vi.mocked(gaugeBlockHeight).mock.calls[0][0].api).toBe(attempts[1].api);
        expect(await failure()).toBe(0);
        expect(vi.getTimerCount()).toBe(3);
    });

    it('cleans up and retries rejected initialization', async () => {
        await startAssetHubService(context);
        attempts[0].reject(new Error('RPC unavailable'));
        await vi.advanceTimersByTimeAsync(0);

        expect(attempts[0].api.disconnect).toHaveBeenCalledOnce();
        expect(await failure()).toBe(1);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(attempts).toHaveLength(2);
    });

    it('disconnects the provider and retries if the API constructor throws', async () => {
        vi.mocked(ApiPromise).mockImplementationOnce(() => {
            throw new Error('Invalid API options');
        });
        await startAssetHubService(context);
        await vi.advanceTimersByTimeAsync(0);

        expect(providers[0].disconnect).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(providers).toHaveLength(2);
        expect(attempts).toHaveLength(1);
    });

    it('still retries if disconnecting the old API fails', async () => {
        await startAssetHubService(context);
        await ready(0);
        attempts[0].api.disconnect.mockRejectedValueOnce(new Error('Already closed'));
        emit(0, 'error');
        await vi.advanceTimersByTimeAsync(5_000);

        expect(attempts).toHaveLength(2);
        await ready(1);
        expect(await failure()).toBe(0);
    });
});
