export type BlockQueueOptions = {
    // Max backlog (next..latest). When exceeded, the oldest blocks are dropped.
    capacity: number;
    onDrop?: (count: number, fromBlock: number, toBlock: number) => void;
};

// Bounded, in-order queue of finalized block numbers. Since finalized heads are
// contiguous monotonic integers, the whole backlog is represented by two cursors:
// gap-fill (heads skipped by the subscription), duplicate/out-of-order deliveries
// and the capacity clamp all fall out of the cursor arithmetic, and the queue's
// memory footprint is constant regardless of how far behind the worker is.
export class BlockQueue {
    private next: number | undefined; // next block number take() will return
    private latest: number | undefined; // highest finalized head seen
    private waiter: (() => void) | undefined;
    private stopped = false;

    constructor(private readonly opts: BlockQueueOptions) {}

    // Called from the subscription callback. Never backfills before the first
    // head seen by this watcher instance.
    pushHead(head: number): void {
        if (this.stopped) return;
        if (this.latest !== undefined && head <= this.latest) return;
        this.latest = head;
        if (this.next === undefined) this.next = head;
        const depth = this.latest - this.next + 1;
        if (depth > this.opts.capacity) {
            const newNext = this.latest - this.opts.capacity + 1;
            this.opts.onDrop?.(newNext - this.next, this.next, newNext - 1);
            this.next = newNext;
        }
        this.wake();
    }

    // Next block number in strict order, or undefined when caught up / stopped.
    take(): number | undefined {
        if (this.stopped || this.next === undefined || this.latest === undefined) return undefined;
        if (this.next > this.latest) return undefined;
        return this.next++;
    }

    get depth(): number {
        if (this.next === undefined || this.latest === undefined) return 0;
        return Math.max(0, this.latest - this.next + 1);
    }

    get latestHead(): number | undefined {
        return this.latest;
    }

    // Resolves when a block may be available or stop() is called.
    async waitForBlock(): Promise<void> {
        if (this.stopped || this.depth > 0) return;
        await new Promise<void>((resolve) => {
            this.waiter = resolve;
        });
    }

    get isStopped(): boolean {
        return this.stopped;
    }

    stop(): void {
        this.stopped = true;
        this.wake();
    }

    private wake(): void {
        this.waiter?.();
        this.waiter = undefined;
    }
}
