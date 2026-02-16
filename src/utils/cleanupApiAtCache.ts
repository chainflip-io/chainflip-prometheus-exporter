import { ApiPromise } from '@polkadot/api';

/**
 * Clears @polkadot/api's internal `.at()` decoration cache to prevent
 * unbounded memory growth. The API caches ApiDecoration instances and
 * versioned registries internally with no eviction policy.
 *
 * This is safe because all metric data has already been scraped and
 * exported to Prometheus — we never need to query historical blocks.
 *
 * Targets @polkadot/api v14.x internal structures:
 *  - __internal__atLast: caches the last .at() decorated API
 *  - __internal__registries: array of versioned metadata registries
 */
export function clearApiAtCache(api: ApiPromise): void {
    try {
        const internal = api as any;

        // Clear the last .at() decoration reference
        if (internal.__internal__atLast) {
            internal.__internal__atLast = null;
        }

        // Trim versioned registries — keep only the latest 2 to avoid
        // re-fetching metadata on every block while still bounding growth.
        // In practice this only grows on runtime upgrades, but stale
        // entries hold references to large metadata blobs.
        const registries = internal.__internal__registries;
        if (Array.isArray(registries) && registries.length > 2) {
            registries.splice(0, registries.length - 2);
        }
    } catch {
        // Silently ignore — internal structure may differ across versions
    }
}
