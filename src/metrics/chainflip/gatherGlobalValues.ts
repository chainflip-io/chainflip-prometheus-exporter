import { ProtocolData } from '../../utils/utils';

export const gatherGlobalValues = (data: ProtocolData): void => {
    global.epochIndex = data.data.epoch.current_epoch_index;
    global.currentBlock = data.blockNumber;
    global.solAggKeyAddress = data.data.sol_aggkey;
    global.dotAggKeyAddress = data.data.dot_aggkey;
    global.solanaCurrentOnChainKey = data.data.sol_onchain_key;
    global.currentAuthorities = data.data.authorities.authorities;
    global.rotationInProgress = data.data.epoch.rotation_phase !== 'Idle';
};
