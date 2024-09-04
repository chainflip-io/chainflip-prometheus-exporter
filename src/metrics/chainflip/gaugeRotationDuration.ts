import promClient, { Counter } from 'prom-client';
import { Context } from '../../lib/interfaces';

enum rotationPhase {
    idle,
    keygensInProgress,
    keyHandoversInProgress,
    activatingKeys,
    newKeysActivated,
    sessionRotating,
}

let currentPhase: rotationPhase = rotationPhase.idle;

// PhaseRotationDuration
const metricName: string = 'cf_rotation_phase_duration';
const metricRotationPhase: Counter = new promClient.Counter({
    name: metricName,
    help: 'The duration of a rotation phase in blocks',
    labelNames: ['rotationPhase'],
    registers: [],
});

// Full Rotation duration
const metricNameRotation: string = 'cf_rotation_duration';
const metricRotationDuration: Counter = new promClient.Counter({
    name: metricNameRotation,
    help: 'The duration of a rotation in blocks',
    registers: [],
});

export const gaugeRotationDuration = async (context: Context): Promise<void> => {
    if (context.config.skipMetrics.includes('cf_rotation_duration')) {
        return;
    }
    const { logger, registry } = context;

    logger.debug(`Scraping ${metricNameRotation}, ${metricName}`);

    if (registry.getSingleMetric(metricNameRotation) === undefined)
        registry.registerMetric(metricRotationDuration);
    if (registry.getSingleMetric(metricName) === undefined)
        registry.registerMetric(metricRotationPhase);

    const currentRotationPhase: any = context.data.epoch.rotation_phase;

    switch (currentRotationPhase) {
        case 'Idle':
            if (currentPhase !== rotationPhase.idle) {
                currentPhase = rotationPhase.idle;
                metricRotationDuration.reset();
                metricRotationPhase.reset();
            }
            break;
        case 'KeygensInProgress':
            if (currentPhase !== rotationPhase.keygensInProgress) {
                currentPhase = rotationPhase.keygensInProgress;
            }
            metricRotationPhase.labels({ rotationPhase: 'keygensInProgress' }).inc();
            metricRotationDuration.inc();
            break;
        case 'KeyHandoversInProgress':
            if (currentPhase !== rotationPhase.keyHandoversInProgress) {
                currentPhase = rotationPhase.keyHandoversInProgress;
            }
            metricRotationPhase.labels({ rotationPhase: 'keyHandoversInProgress' }).inc();
            metricRotationDuration.inc();
            break;
        case 'ActivatingKeys':
            if (currentPhase !== rotationPhase.activatingKeys) {
                currentPhase = rotationPhase.activatingKeys;
            }
            metricRotationPhase.labels({ rotationPhase: 'activatingKeys' }).inc();
            metricRotationDuration.inc();
            break;
        case 'NewKeysActivated':
            if (currentPhase !== rotationPhase.newKeysActivated) {
                currentPhase = rotationPhase.newKeysActivated;
            }
            metricRotationPhase.labels({ rotationPhase: 'newKeysActivated' }).inc();
            metricRotationDuration.inc();
            break;
        case 'SessionRotating':
            if (currentPhase !== rotationPhase.sessionRotating) {
                currentPhase = rotationPhase.sessionRotating;
            }
            metricRotationPhase.labels({ rotationPhase: 'sessionRotating' }).inc();
            metricRotationDuration.inc();
            break;
    }
};
