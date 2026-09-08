import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { countQueuedSafeElections } from './gaugeElections';

type ElectionLog = {
    message: string;
    data: {
        bw_deposit_channels_queued_safe: Record<string, unknown>;
    };
};

test('counts queued safe elections from Ethereum and Arbitrum log lines', () => {
    const logs = readFileSync(resolve(__dirname, 'fixtures/queuedSafeElectionLogs.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as ElectionLog);

    expect(logs).toHaveLength(2);
    const [arbitrumLog, ethereumLog] = logs;

    expect(arbitrumLog.message).toBe('Arbitrum_BW_deposit_channels_state');
    expect(Object.entries(arbitrumLog.data.bw_deposit_channels_queued_safe)).toEqual([
        ['{"root":497523120}', { root: 497920536 }],
    ]);
    expect(countQueuedSafeElections(arbitrumLog.data.bw_deposit_channels_queued_safe)).toBe(
        397_416,
    );

    expect(ethereumLog.message).toBe('Ethereum_BW_deposit_channels_state');
    expect(Object.entries(ethereumLog.data.bw_deposit_channels_queued_safe)).toEqual([
        ['25817364', 25825664],
    ]);
    expect(countQueuedSafeElections(ethereumLog.data.bw_deposit_channels_queued_safe)).toBe(8_300);
});
