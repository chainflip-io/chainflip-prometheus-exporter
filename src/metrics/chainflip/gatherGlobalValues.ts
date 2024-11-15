import { Context } from '../../lib/interfaces';
import base58 from 'bs58';
import { hexToU8a } from '@polkadot/util';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    global.epochIndex = Number(context.data.epoch.current_epoch_index);
    const logger = context.logger;
    global.currentBlock = Number(context.header.number);
    global.dotAggKeyAddress = context.data.dot_aggkey;
    global.solAggKeyAddress = context.data.sol_aggkey;
    global.solanaCurrentOnChainKey = context.data.sol_onchain_key;
};
