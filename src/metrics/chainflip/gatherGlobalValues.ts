import { Context } from '../../lib/interfaces';
import base58 from 'bs58';
import { hexToU8a } from '@polkadot/util';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    global.epochIndex = Number(context.data.epoch.current_epoch_index);
    const logger = context.logger;

    global.dotAggKeyAddress = context.data.dot_aggkey;
    try {
        const api = context.api;
        const epoch = (await api.query.solanaThresholdSigner.currentKeyEpoch()).toJSON();
        const solAggKey = (await api.query.solanaThresholdSigner.keys(epoch)).toJSON();
        global.solAggKeyAddress = base58.encode(hexToU8a(solAggKey));

        const onChainKey = (await api.query.solanaBroadcaster.currentOnChainKey()).toJSON();
        global.solanaCurrentOnChainKey = base58.encode(hexToU8a(onChainKey));
    } catch (err) {
        logger.error(err);
    }
};
