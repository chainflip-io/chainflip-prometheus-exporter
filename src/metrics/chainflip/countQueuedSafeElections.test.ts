import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
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

    assert.equal(logs.length, 2);
    const [arbitrumLog, ethereumLog] = logs;

    assert.equal(arbitrumLog.message, 'Arbitrum_BW_deposit_channels_state');
    assert.deepEqual(Object.entries(arbitrumLog.data.bw_deposit_channels_queued_safe), [
        ['{"root":497523120}', { root: 497920536 }],
    ]);
    assert.equal(
        countQueuedSafeElections(arbitrumLog.data.bw_deposit_channels_queued_safe),
        397_416,
    );

    assert.equal(ethereumLog.message, 'Ethereum_BW_deposit_channels_state');
    assert.deepEqual(Object.entries(ethereumLog.data.bw_deposit_channels_queued_safe), [
        ['25817364', 25825664],
    ]);
    assert.equal(countQueuedSafeElections(ethereumLog.data.bw_deposit_channels_queued_safe), 8_300);
});
