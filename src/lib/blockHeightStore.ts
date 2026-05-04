export type BlockLagChain =
    | 'bitcoin'
    | 'ethereum'
    | 'arbitrum'
    | 'solana'
    | 'assethub';

type Heights = { tracked: number | null; external: number | null };

const state: Record<BlockLagChain, Heights> = {
    bitcoin: { tracked: null, external: null },
    ethereum: { tracked: null, external: null },
    arbitrum: { tracked: null, external: null },
    solana: { tracked: null, external: null },
    assethub: { tracked: null, external: null },
};

export const blockHeightStore = {
    setTracked: (chain: BlockLagChain, height: number) => {
        state[chain].tracked = height;
    },
    setExternal: (chain: BlockLagChain, height: number) => {
        state[chain].external = height;
    },
    getTracked: (chain: BlockLagChain): number | null => state[chain].tracked,
    getExternal: (chain: BlockLagChain): number | null => state[chain].external,
    isChain: (value: string): value is BlockLagChain => value in state,
    chains: (): BlockLagChain[] => Object.keys(state) as BlockLagChain[],
};
