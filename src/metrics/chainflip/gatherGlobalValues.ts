import { Context } from '../../lib/interfaces';

export const gatherGlobalValues = async (context: Context): Promise<void> => {
    const { logger, api, registry, metricFailure } = context;

    try {
        global.epochIndex = Number(context.data.epoch.current_epoch_index);

        global.dotAggKeyAddress = context.data.dot_aggkey;
    } catch (err) {
        logger.error(err);
    }
};
