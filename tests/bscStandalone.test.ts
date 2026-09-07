import { describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import promClient from 'prom-client';
import { Logger } from 'winston';
import { BscConfig } from '../src/config/interfaces';
import { Context } from '../src/lib/interfaces';
import { blockHeightStore } from '../src/lib/blockHeightStore';
import { gaugeBlockHeight, gaugeBnbBalance, gaugeTokenBalance } from '../src/metrics/bsc';
import { createBscProvider, validateBscChainId } from '../src/watchers/bsc';
import { RPC_TIMEOUT_MS } from '../src/utils/utils';

const wallet = {
    alias: 'validator',
    address: '0x0000000000000000000000000000000000000001',
};
const token = {
    symbol: 'USDT',
    address: '0x0000000000000000000000000000000000000002',
};

function makeConfig(skipMetrics: string[] = []): BscConfig {
    return {
        enabled: true,
        network: 'localnet',
        networkId: 343,
        defaultMetrics: [],
        contracts: [],
        wallets: [wallet],
        tokens: [token],
        skipMetrics,
    };
}

function makeContext(
    config: BscConfig = makeConfig(),
    additions: Record<string, unknown> = {},
): { context: Context; registry: promClient.Registry; logger: Logger } {
    const registry = new promClient.Registry();
    const metricFailure = new promClient.Gauge({
        name: 'metric_scrape_failure',
        help: 'Metric is failing to report',
        labelNames: ['metric'],
        registers: [registry],
    });
    const logger = {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    } as unknown as Logger;

    return {
        context: {
            logger,
            registry,
            config,
            metricFailure,
            ...additions,
        },
        registry,
        logger,
    };
}

describe('BSC standalone metrics', () => {
    it('reports the external block height and updates the lag store', async () => {
        const getBlockNumber = vi.fn().mockResolvedValue(12_345);
        const { context, registry } = makeContext(makeConfig(), {
            httpProvider: { getBlockNumber },
        });

        await gaugeBlockHeight(context);

        expect(getBlockNumber).toHaveBeenCalledOnce();
        expect(blockHeightStore.getExternal('bsc')).toBe(12_345);
        const output = await registry.metrics();
        expect(output).toContain('bsc_block_height 12345');
        expect(output).toContain('metric_scrape_failure{metric="bsc_block_height"} 0');
    });

    it('reports BNB balances in whole-token units', async () => {
        const getBalance = vi.fn().mockResolvedValue(1_250_000_000_000_000_000n);
        const { context, registry } = makeContext(makeConfig(), {
            httpProvider: { getBalance },
        });

        await gaugeBnbBalance(context);

        expect(getBalance).toHaveBeenCalledWith(wallet.address);
        const output = await registry.metrics();
        expect(output).toContain(
            `bsc_bnb_balance{address="${wallet.address}",alias="${wallet.alias}"} 1.25`,
        );
        expect(output).toContain('metric_scrape_failure{metric="bsc_bnb_balance"} 0');
    });

    it('reports token balances and caches contract decimals across scrapes', async () => {
        const decimals = vi.fn().mockResolvedValue(18n);
        const balanceOf = vi.fn().mockResolvedValue(1_500_000_000_000_000_000n);
        const tokenContract = { decimals, balanceOf };
        const { context, registry } = makeContext(makeConfig(), {
            bscTokenContracts: [{ ...token, contract: tokenContract }],
            bscTokenDecimals: new Map<string, number>(),
        });

        await gaugeTokenBalance(context);
        await gaugeTokenBalance(context);

        expect(decimals).toHaveBeenCalledOnce();
        expect(balanceOf).toHaveBeenCalledTimes(2);
        expect(balanceOf).toHaveBeenCalledWith(wallet.address);
        const output = await registry.metrics();
        expect(output).toContain(
            `bsc_token_balance{symbol="USDT",contract="${token.address}",address="${wallet.address}",alias="${wallet.alias}"} 1.5`,
        );
        expect(output).toContain('metric_scrape_failure{metric="bsc_token_balance"} 0');
    });

    it.each([
        { metricName: 'bsc_block_height', scrape: gaugeBlockHeight },
        { metricName: 'bsc_bnb_balance', scrape: gaugeBnbBalance },
        { metricName: 'bsc_token_balance', scrape: gaugeTokenBalance },
    ])(
        'does not register or scrape a skipped $metricName metric',
        async ({ metricName, scrape }) => {
            const { context, registry } = makeContext(makeConfig([metricName]));

            await scrape(context);

            expect(registry.getSingleMetric(metricName)).toBeUndefined();
        },
    );

    it.each([
        {
            metricName: 'bsc_block_height',
            scrape: gaugeBlockHeight,
            additions: { httpProvider: { getBlockNumber: vi.fn().mockRejectedValue('offline') } },
        },
        {
            metricName: 'bsc_bnb_balance',
            scrape: gaugeBnbBalance,
            additions: { httpProvider: { getBalance: vi.fn().mockRejectedValue('offline') } },
        },
        {
            metricName: 'bsc_token_balance',
            scrape: gaugeTokenBalance,
            additions: {
                bscTokenContracts: [
                    {
                        ...token,
                        contract: {
                            decimals: vi.fn().mockRejectedValue('offline'),
                            balanceOf: vi.fn(),
                        },
                    },
                ],
                bscTokenDecimals: new Map<string, number>(),
            },
        },
    ])('sets scrape failure when $metricName fails', async ({ metricName, scrape, additions }) => {
        const { context, registry, logger } = makeContext(makeConfig(), additions);

        await scrape(context);

        const output = await registry.metrics();
        expect(output).toContain(`metric_scrape_failure{metric="${metricName}"} 1`);
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('BSC provider setup', () => {
    it('configures URL credentials, timeout, static network, and unbatched requests', () => {
        const provider = createBscProvider(
            'https://alice:secret@rpc.example.test/path?ignored=yes',
        );
        const request = provider._getConnection();

        expect(request.url).toBe('https://rpc.example.test/path');
        expect(request.credentials).toBe('alice:secret');
        expect(request.timeout).toBe(RPC_TIMEOUT_MS);
        expect(provider._getOption('staticNetwork')).toBe(true);
        expect(provider._getOption('batchMaxCount')).toBe(1);

        provider.destroy();
    });

    it('accepts the configured BSC chain ID', async () => {
        const provider = {
            getNetwork: vi.fn().mockResolvedValue(ethers.Network.from(56)),
        } as unknown as Pick<ethers.JsonRpcProvider, 'getNetwork'>;

        await expect(validateBscChainId(provider, 56)).resolves.toBeUndefined();
    });

    it('rejects an RPC endpoint on another chain', async () => {
        const provider = {
            getNetwork: vi.fn().mockResolvedValue(ethers.Network.from(1)),
        } as unknown as Pick<ethers.JsonRpcProvider, 'getNetwork'>;

        await expect(validateBscChainId(provider, 56)).rejects.toThrow(
            'BSC RPC chain ID mismatch: expected 56, received 1',
        );
    });
});
