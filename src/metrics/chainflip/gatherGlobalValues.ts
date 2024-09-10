import { Context } from '../../lib/interfaces';
import base58 from 'bs58';
import { hexToU8a } from '@polkadot/util';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    global.epochIndex = Number(context.data.epoch.current_epoch_index);

    global.dotAggKeyAddress = context.data.dot_aggkey;

    const api = context.api;
    const epoch = (await api.query.solanaThresholdSigner.currentKeyEpoch()).toJSON();
    const solAggKey = (await api.query.solanaThresholdSigner.keys(epoch)).toJSON();
    global.solAggKeyAddress = base58.encode(hexToU8a(solAggKey));
};
