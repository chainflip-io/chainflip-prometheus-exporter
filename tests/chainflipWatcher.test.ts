import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Registry } from 'prom-client';
import { Logger } from 'winston';
import { Context } from '../src/lib/interfaces';
import { gaugeBlockHeight } from '../src/metrics/chainflip';
import startChainflipService from '../src/watchers/chainflip';

vi.mock('@polkadot/api', () => ({
    ApiPromise: Object.assign(vi.fn(), { create: vi.fn() }),
    WsProvider: vi.fn(),
}));
vi.mock('../src/metrics/chainflip');
vi.mock('../src/metrics/chainflip/gaugeKeyActivationBroadcast');
vi.mock('../src/metrics/chainflip/gaugeOpenElections');
vi.mock('../src/metrics/chainflip/gaugeSafeMode');
vi.mock('../src/utils/makeRpcRequest', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function makeApi() {
    const ready = deferred<void>();
    const unsubscribe = vi.fn();
    const api = {
        isReady: ready.promise,
        isReadyOrError: ready.promise,
        on: vi.fn(),
        disconnect: vi.fn().mockResolvedValue(undefined),
        at: vi.fn().mockResolvedValue({}),
        rpc: {
            chain: {
                subscribeFinalizedHeads: vi.fn().mockResolvedValue(unsubscribe),
                getBlockHash: vi.fn().mockResolvedValue({ toJSON: () => '0x1234' }),
                getBlock: vi.fn().mockResolvedValue({}),
            },
        },
    };
    return { api, ready, unsubscribe };
}

describe('Chainflip watcher startup recovery', () => {
    let attempts: ReturnType<typeof makeApi>[];
    let providers: { on: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[];
    let registry: Registry;
    let context: Context;
    let rejectionListeners: NodeJS.UnhandledRejectionListener[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();
        attempts = [];
        providers = [];
        registry = new Registry();
        context = {
            logger: {
                info: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            } as unknown as Logger,
            registry,
            env: { CF_WS_ENDPOINT: 'wss://rpc.example.test' },
            config: {
                enabled: true,
                network: 'test',
                skipMetrics: [],
                defaultMetrics: [],
                accounts: [],
                skipEvents: [],
                eventLog: false,
            },
        };
        rejectionListeners = process.listeners('unhandledRejection');

        vi.mocked(WsProvider).mockImplementation(function () {
            const provider = {
                on: vi.fn(),
                disconnect: vi.fn().mockResolvedValue(undefined),
            };
            providers.push(provider);
            return provider as unknown as WsProvider;
        });
        vi.mocked(ApiPromise).mockImplementation(function () {
            const attempt = makeApi();
            attempts.push(attempt);
            return attempt.api as unknown as ApiPromise;
        });
        vi.mocked(ApiPromise.create).mockImplementation(async (options) => {
            const api = new ApiPromise(options);
            await api.isReady;
            return api;
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        for (const listener of process.listeners('unhandledRejection')) {
            if (!rejectionListeners.includes(listener)) {
                process.removeListener('unhandledRejection', listener);
            }
        }
    });

    async function finishStartup(attempt: ReturnType<typeof makeApi>) {
        attempt.ready.resolve();
        await vi.advanceTimersByTimeAsync(0);
    }

    async function emitHead(attempt: ReturnType<typeof makeApi>, blockNumber: number) {
        const [onHead] = attempt.api.rpc.chain.subscribeFinalizedHeads.mock.calls[0];
        onHead({ toJSON: () => ({ number: blockNumber }) });
        await vi.advanceTimersByTimeAsync(0);
    }

    async function expireStartup() {
        // The watchdog checks every 15s and restarts when the head age exceeds 120s.
        await vi.advanceTimersByTimeAsync(135_000);
        expect(attempts[0].api.disconnect).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(attempts).toHaveLength(2);
    }

    it('disconnects stalled initialization and resumes processing with a fresh API', async () => {
        await startChainflipService(context);
        await expireStartup();

        const replacement = attempts[1];
        await finishStartup(replacement);
        await emitHead(replacement, 123);

        expect(replacement.api.rpc.chain.getBlockHash).toHaveBeenCalledWith(123);
        expect(gaugeBlockHeight).toHaveBeenCalledOnce();
        expect((await registry.getSingleMetric('cf_watcher_failure')!.get()).values[0].value).toBe(
            0,
        );

        // A delayed close event from the old connection must not mark the replacement unhealthy.
        const [, onDisconnected] = providers[0].on.mock.calls.find(
            ([event]) => event === 'disconnected',
        )!;
        onDisconnected();
        expect((await registry.getSingleMetric('cf_watcher_failure')!.get()).values[0].value).toBe(
            0,
        );
    });

    it('retries an initialization error immediately instead of waiting for the watchdog', async () => {
        await startChainflipService(context);
        attempts[0].ready.reject(new Error('RPC unavailable during initialization'));
        await vi.advanceTimersByTimeAsync(0);

        expect(attempts[0].api.disconnect).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(attempts).toHaveLength(2);
    });

    it('logs the message of WebSocket error events instead of [object ErrorEvent]', async () => {
        // Shaped like the ErrorEvent that Node's WebSocket and `ws` emit on a failed connect.
        class FakeErrorEvent {
            readonly [Symbol.toStringTag] = 'ErrorEvent';
            constructor(readonly message: string) {}
        }
        const errorEvent = new FakeErrorEvent('connect ECONNREFUSED 10.0.0.1:9944');

        await startChainflipService(context);
        const [, onProviderError] = providers[0].on.mock.calls.find(
            ([event]) => event === 'error',
        )!;
        onProviderError(errorEvent);
        attempts[0].ready.reject(errorEvent as unknown as Error);
        await vi.advanceTimersByTimeAsync(0);

        const logged = vi.mocked(context.logger.error).mock.calls.map(([msg]) => String(msg));
        expect(logged).toContain('ws provider error connect ECONNREFUSED 10.0.0.1:9944');
        expect(logged).toContainEqual(
            expect.stringContaining('startup failure: connect ECONNREFUSED 10.0.0.1:9944'),
        );
        expect(logged.filter((msg) => msg.includes('[object'))).toEqual([]);
    });

    it('does not subscribe when an expired initialization completes after its replacement starts', async () => {
        await startChainflipService(context);
        await expireStartup();
        await finishStartup(attempts[1]);

        await finishStartup(attempts[0]);

        expect(attempts[0].api.rpc.chain.subscribeFinalizedHeads).not.toHaveBeenCalled();
        await emitHead(attempts[1], 456);
        expect(attempts[0].api.rpc.chain.getBlockHash).not.toHaveBeenCalled();
        expect(gaugeBlockHeight).toHaveBeenCalledOnce();
    });

    it('unsubscribes and ignores late heads when expired subscription setup completes', async () => {
        await startChainflipService(context);
        const subscription = deferred<() => void>();
        attempts[0].api.rpc.chain.subscribeFinalizedHeads.mockReturnValueOnce(subscription.promise);
        await finishStartup(attempts[0]);
        await expireStartup();
        await finishStartup(attempts[1]);

        subscription.resolve(attempts[0].unsubscribe);
        await vi.advanceTimersByTimeAsync(0);
        await emitHead(attempts[0], 789);

        expect(attempts[0].unsubscribe).toHaveBeenCalledOnce();
        expect(attempts[0].api.rpc.chain.getBlockHash).not.toHaveBeenCalled();
        expect(gaugeBlockHeight).not.toHaveBeenCalled();
        await emitHead(attempts[1], 790);
        expect(gaugeBlockHeight).toHaveBeenCalledOnce();
    });

    it('disconnects the provider if constructing the API throws', async () => {
        vi.mocked(ApiPromise).mockImplementationOnce(() => {
            throw new Error('Invalid API options');
        });

        await startChainflipService(context);
        await vi.advanceTimersByTimeAsync(0);

        expect(providers[0].disconnect).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(attempts).toHaveLength(1);
        expect(providers).toHaveLength(2);
    });
});
