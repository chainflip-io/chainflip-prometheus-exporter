import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import jsonvalidator from 'jsonschema';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import berghain from '../config/berghain.json';
import localnet from '../config/localnet.json';
import schema from '../config/schema.json';
import sisyphos from '../config/sisyphos.json';
import { validateConfig } from '../src/config/getConfig';

type JsonSchema = Record<string, unknown>;

const definitions = (schema as unknown as { definitions: Record<string, JsonSchema> }).definitions;
const configSchema = {
    ...schema,
    $ref: '#/definitions/Config',
};

const configurations = [
    {
        name: 'localnet',
        config: localnet,
        network: 'localnet',
        networkId: 343,
        usdt: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        keyManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        vault: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    },
    {
        name: 'sisyphos',
        config: sisyphos,
        network: 'testnet',
        networkId: 97,
        usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        keyManager: '0xcA2Fc8ABb5ACEc1CA19c684BdF2959B32e83bacF',
        vault: '0x3362FD7D8264387Ac7D686084CBB774bB09732DF',
    },
    {
        name: 'berghain',
        config: berghain,
        network: 'mainnet',
        networkId: 56,
        usdt: '0x55d398326f99059fF775485246999027B3197955',
        keyManager: '0xBFe612c77C2807Ac5a6A41F84436287578000275',
        vault: '0x79001a5e762f3bEFC8e5871b42F6734e00498920',
    },
] as const;

describe('BSC configuration', () => {
    it.each(configurations)('validates the $name BSC configuration', ({ config }) => {
        expect(jsonvalidator.validate(config.bsc, definitions.BscConfig).valid).toBe(true);
    });

    it.each(configurations)(
        'uses the canonical $name network and contract addresses',
        ({ config, network, networkId, usdt, keyManager, vault }) => {
            expect(config.bsc).toMatchObject({
                enabled: true,
                network,
                networkId,
                defaultMetrics: [],
                skipMetrics: [],
                contracts: [
                    { alias: 'key-manager', address: keyManager },
                    { alias: 'vault', address: vault },
                ],
                tokens: [{ symbol: 'USDT', address: usdt }],
            });
            expect(config.bsc.wallets).toEqual(config.arb.wallets);
        },
    );

    it('requires the BSC section in the complete exporter configuration', () => {
        const { bsc: _bsc, ...withoutBsc } = localnet;

        expect(() => validateConfig(withoutBsc)).toThrow(
            'Invalid exporter config: missing required top-level field "bsc"',
        );

        const result = jsonvalidator.validate(withoutBsc, configSchema);

        expect(result.valid).toBe(false);
        expect(result.errors.some((error) => error.message === 'requires property "bsc"')).toBe(
            true,
        );
    });

    it('reports a missing field inside the BSC section', () => {
        const config = structuredClone(localnet) as Record<string, any>;
        delete config.bsc.enabled;

        expect(() => validateConfig(config)).toThrow(
            'Invalid Bsc config: instance requires property "enabled"',
        );
    });

    it('prints the missing BSC error and exits instead of hanging during startup', () => {
        const directory = mkdtempSync(join(tmpdir(), 'chainflip-exporter-config-'));
        const path = join(directory, 'missing-bsc.json');
        const { bsc: _bsc, ...withoutBsc } = localnet;
        writeFileSync(path, JSON.stringify(withoutBsc));

        try {
            const child = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'src/app.ts'], {
                cwd: process.cwd(),
                env: { ...process.env, CONFIG_PATH: path },
                encoding: 'utf8',
                timeout: 10_000,
            });
            const output = `${child.stdout}${child.stderr}`;

            expect(child.error).toBeUndefined();
            expect(child.status).toBe(1);
            expect(output).toContain('Invalid exporter config');
            expect(output).toContain('missing required top-level field \\"bsc\\"');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    }, 15_000);
});
