import { Context } from '../../lib/interfaces';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    global.epochIndex = Number(context.data.epoch.current_epoch_index);

    global.dotAggKeyAddress = context.data.dot_aggkey;
};
