import { Landmark } from '../types';

export interface SquatKeyframe {
    name: string;
    progress: number;
    kneeAngle: number;
    hipAngle: number;
    ankleAngle: number;
    torsoAngle: number;
    description: string;
}

export interface BiomechanicalSquatPose {
    NOSE: Landmark;
    LEFT_EYE_INNER: Landmark;
    LEFT_EYE: Landmark;
    LEFT_EYE_OUTER: Landmark;
    RIGHT_EYE_INNER: Landmark;
    RIGHT_EYE: Landmark;
    RIGHT_EYE_OUTER: Landmark;
    LEFT_EAR: Landmark;
    RIGHT_EAR: Landmark;
    MOUTH_LEFT: Landmark;
    MOUTH_RIGHT: Landmark;
    LEFT_SHOULDER: Landmark;
    RIGHT_SHOULDER: Landmark;
    LEFT_ELBOW: Landmark;
    RIGHT_ELBOW: Landmark;
    LEFT_WRIST: Landmark;
    RIGHT_WRIST: Landmark;
    LEFT_HIP: Landmark;
    RIGHT_HIP: Landmark;
    LEFT_KNEE: Landmark;
    RIGHT_KNEE: Landmark;
    LEFT_ANKLE: Landmark;
    RIGHT_ANKLE: Landmark;
    LEFT_HEEL: Landmark;
    RIGHT_HEEL: Landmark;
    LEFT_FOOT_INDEX: Landmark;
    RIGHT_FOOT_INDEX: Landmark;
}

export const SQUAT_KEYFRAMES: SquatKeyframe[] = [
    {
        name: 'Standing',
        progress: 0,
        kneeAngle: 175,
        hipAngle: 175,
        ankleAngle: 90,
        torsoAngle: 5,
        description: 'Starting position - fully extended'
    },
    {
        name: 'Early Descent',
        progress: 0.20,
        kneeAngle: 155,
        hipAngle: 150,
        ankleAngle: 85,
        torsoAngle: 15,
        description: 'Initiating descent with hip hinge'
    },
    {
        name: 'Mid Descent',
        progress: 0.40,
        kneeAngle: 130,
        hipAngle: 120,
        ankleAngle: 75,
        torsoAngle: 30,
        description: 'Halfway down with controlled movement'
    },
    {
        name: 'Bottom Position',
        progress: 0.50,
        kneeAngle: 110,
        hipAngle: 95,
        ankleAngle: 70,
        torsoAngle: 45,
        description: 'Full depth - hip below knee'
    },
    {
        name: 'Early Ascent',
        progress: 0.65,
        kneeAngle: 130,
        hipAngle: 120,
        ankleAngle: 75,
        torsoAngle: 35,
        description: 'Driving up through heels'
    },
    {
        name: 'Mid Ascent',
        progress: 0.80,
        kneeAngle: 155,
        hipAngle: 150,
        ankleAngle: 85,
        torsoAngle: 20,
        description: 'Extending hips and knees'
    },
    {
        name: 'Near Complete',
        progress: 0.95,
        kneeAngle: 170,
        hipAngle: 170,
        ankleAngle: 88,
        torsoAngle: 8,
        description: 'Almost fully extended'
    },
    {
        name: 'Standing Complete',
        progress: 1.0,
        kneeAngle: 175,
        hipAngle: 175,
        ankleAngle: 90,
        torsoAngle: 5,
        description: 'Completed rep - ready for next'
    }
];

const BODY_PROPORTIONS = {
    totalHeight: 1.0,
    shoulderToHipRatio: 0.30,
    hipToKneeRatio: 0.25,
    kneeToAnkleRatio: 0.25,
    shoulderWidth: 0.20,
    footRotation: 7,
    armBend: 25
};

function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

function createLandmark(x: number, y: number, z: number = 0, visibility: number = 1): Landmark {
    return { x, y, z, visibility };
}

function calculateJointPosition(
    basePoint: { x: number; y: number; z: number },
    angle: number,
    distance: number,
    direction: 'vertical' | 'horizontal' | 'angular'
): { x: number; y: number; z: number } {
    const rad = degreesToRadians(angle);

    if (direction === 'vertical') {
        return {
            x: basePoint.x,
            y: basePoint.y + distance,
            z: basePoint.z
        };
    } else if (direction === 'horizontal') {
        return {
            x: basePoint.x + distance,
            y: basePoint.y,
            z: basePoint.z
        };
    } else {
        return {
            x: basePoint.x + Math.cos(rad) * distance,
            y: basePoint.y + Math.sin(rad) * distance,
            z: basePoint.z
        };
    }
}

export function generateBiomechanicalSquatPose(keyframe: SquatKeyframe): BiomechanicalSquatPose {
    const centerX = 0.5;
    const baseY = 0.1;
    const props = BODY_PROPORTIONS;

    const shoulderWidth = props.shoulderWidth;
    const hipWidth = shoulderWidth * 0.95;
    const kneeWidth = shoulderWidth * 1.0;
    const ankleWidth = shoulderWidth * 0.85;

    const torsoAngleRad = degreesToRadians(keyframe.torsoAngle);
    const kneeAngleRad = degreesToRadians(180 - keyframe.kneeAngle);
    const hipAngleRad = degreesToRadians(180 - keyframe.hipAngle);
    const ankleAngleRad = degreesToRadians(keyframe.ankleAngle - 90);

    const hipLift = Math.abs(keyframe.kneeAngle - 175) / 175;
    const depthFactor = 1 - (keyframe.kneeAngle - 110) / (175 - 110);

    const ankleY = baseY + 0.75;
    const ankleZ = -0.02;

    const shinLength = props.kneeToAnkleRatio;
    const kneeForward = Math.sin(ankleAngleRad) * shinLength * 0.3;
    const kneeUp = Math.cos(kneeAngleRad) * shinLength * 0.8;
    const kneeY = ankleY - shinLength + (depthFactor * 0.15);
    const kneeZ = ankleZ + kneeForward;

    const thighLength = props.hipToKneeRatio;
    const hipBackward = Math.sin(hipAngleRad) * thighLength * depthFactor * 0.4;
    const hipY = kneeY - thighLength + (depthFactor * 0.2);
    const hipZ = kneeZ - hipBackward;

    const torsoLength = props.shoulderToHipRatio;
    const shoulderForward = Math.sin(torsoAngleRad) * torsoLength * 0.5;
    const shoulderY = hipY - torsoLength;
    const shoulderZ = hipZ + shoulderForward;

    const neckLength = 0.08;
    const headY = shoulderY - neckLength;

    const leftAnkle = createLandmark(centerX - ankleWidth / 2, ankleY, ankleZ);
    const rightAnkle = createLandmark(centerX + ankleWidth / 2, ankleY, ankleZ);

    const leftHeel = createLandmark(centerX - ankleWidth / 2, ankleY + 0.02, ankleZ - 0.05);
    const rightHeel = createLandmark(centerX + ankleWidth / 2, ankleY + 0.02, ankleZ - 0.05);

    const footIndexOffset = 0.06;
    const leftFootIndex = createLandmark(centerX - ankleWidth / 2, ankleY + 0.01, ankleZ + footIndexOffset);
    const rightFootIndex = createLandmark(centerX + ankleWidth / 2, ankleY + 0.01, ankleZ + footIndexOffset);

    const leftKnee = createLandmark(centerX - kneeWidth / 2, kneeY, kneeZ);
    const rightKnee = createLandmark(centerX + kneeWidth / 2, kneeY, kneeZ);

    const leftHip = createLandmark(centerX - hipWidth / 2, hipY, hipZ);
    const rightHip = createLandmark(centerX + hipWidth / 2, hipY, hipZ);

    const leftShoulder = createLandmark(centerX - shoulderWidth / 2, shoulderY, shoulderZ);
    const rightShoulder = createLandmark(centerX + shoulderWidth / 2, shoulderY, shoulderZ);

    const armAngle = 45 + (depthFactor * 20);
    const armAngleRad = degreesToRadians(armAngle);
    const upperArmLength = 0.15;
    const forearmLength = 0.14;

    const leftElbow = createLandmark(
        leftShoulder.x - Math.cos(armAngleRad) * upperArmLength * 0.5,
        leftShoulder.y + Math.sin(armAngleRad) * upperArmLength,
        leftShoulder.z - 0.08
    );
    const rightElbow = createLandmark(
        rightShoulder.x + Math.cos(armAngleRad) * upperArmLength * 0.5,
        rightShoulder.y + Math.sin(armAngleRad) * upperArmLength,
        rightShoulder.z - 0.08
    );

    const leftWrist = createLandmark(
        leftElbow.x - 0.02,
        leftElbow.y + forearmLength,
        leftElbow.z
    );
    const rightWrist = createLandmark(
        rightElbow.x + 0.02,
        rightElbow.y + forearmLength,
        rightElbow.z
    );

    const headWidth = 0.08;
    const leftEar = createLandmark(centerX - headWidth / 2, headY, shoulderZ + 0.02);
    const rightEar = createLandmark(centerX + headWidth / 2, headY, shoulderZ + 0.02);

    const faceZ = shoulderZ + 0.05;
    const nose = createLandmark(centerX, headY + 0.02, faceZ);

    const eyeY = headY + 0.01;
    const eyeWidth = 0.03;
    const leftEye = createLandmark(centerX - eyeWidth / 2, eyeY, faceZ);
    const rightEye = createLandmark(centerX + eyeWidth / 2, eyeY, faceZ);

    const leftEyeInner = createLandmark(centerX - eyeWidth / 4, eyeY, faceZ);
    const rightEyeInner = createLandmark(centerX + eyeWidth / 4, eyeY, faceZ);

    const leftEyeOuter = createLandmark(centerX - eyeWidth * 0.75, eyeY, faceZ);
    const rightEyeOuter = createLandmark(centerX + eyeWidth * 0.75, eyeY, faceZ);

    const mouthY = headY + 0.04;
    const mouthWidth = 0.025;
    const mouthLeft = createLandmark(centerX - mouthWidth, mouthY, faceZ);
    const mouthRight = createLandmark(centerX + mouthWidth, mouthY, faceZ);

    return {
        NOSE: nose,
        LEFT_EYE_INNER: leftEyeInner,
        LEFT_EYE: leftEye,
        LEFT_EYE_OUTER: leftEyeOuter,
        RIGHT_EYE_INNER: rightEyeInner,
        RIGHT_EYE: rightEye,
        RIGHT_EYE_OUTER: rightEyeOuter,
        LEFT_EAR: leftEar,
        RIGHT_EAR: rightEar,
        MOUTH_LEFT: mouthLeft,
        MOUTH_RIGHT: mouthRight,
        LEFT_SHOULDER: leftShoulder,
        RIGHT_SHOULDER: rightShoulder,
        LEFT_ELBOW: leftElbow,
        RIGHT_ELBOW: rightElbow,
        LEFT_WRIST: leftWrist,
        RIGHT_WRIST: rightWrist,
        LEFT_HIP: leftHip,
        RIGHT_HIP: rightHip,
        LEFT_KNEE: leftKnee,
        RIGHT_KNEE: rightKnee,
        LEFT_ANKLE: leftAnkle,
        RIGHT_ANKLE: rightAnkle,
        LEFT_HEEL: leftHeel,
        RIGHT_HEEL: rightHeel,
        LEFT_FOOT_INDEX: leftFootIndex,
        RIGHT_FOOT_INDEX: rightFootIndex
    };
}

export function interpolateKeyframes(keyframes: SquatKeyframe[], progress: number): SquatKeyframe {
    if (progress <= 0) return keyframes[0];
    if (progress >= 1) return keyframes[keyframes.length - 1];

    let lowerFrame = keyframes[0];
    let upperFrame = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].progress && progress <= keyframes[i + 1].progress) {
            lowerFrame = keyframes[i];
            upperFrame = keyframes[i + 1];
            break;
        }
    }

    const range = upperFrame.progress - lowerFrame.progress;
    const localProgress = range === 0 ? 0 : (progress - lowerFrame.progress) / range;

    const eased = easeInOutCubic(localProgress);

    return {
        name: `Interpolated ${(progress * 100).toFixed(1)}%`,
        progress: progress,
        kneeAngle: lowerFrame.kneeAngle + (upperFrame.kneeAngle - lowerFrame.kneeAngle) * eased,
        hipAngle: lowerFrame.hipAngle + (upperFrame.hipAngle - lowerFrame.hipAngle) * eased,
        ankleAngle: lowerFrame.ankleAngle + (upperFrame.ankleAngle - lowerFrame.ankleAngle) * eased,
        torsoAngle: lowerFrame.torsoAngle + (upperFrame.torsoAngle - lowerFrame.torsoAngle) * eased,
        description: 'Interpolated frame'
    };
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function calculateSquatProgress(timestamp: number, cycleDuration: number = 6000): number {
    const descendDuration = cycleDuration * 0.5;
    const pauseDuration = cycleDuration * 0.08;
    const ascendDuration = cycleDuration * 0.42;

    const cycleTime = timestamp % cycleDuration;

    if (cycleTime < descendDuration) {
        const t = cycleTime / descendDuration;
        return t * 0.5;
    } else if (cycleTime < descendDuration + pauseDuration) {
        return 0.5;
    } else {
        const t = (cycleTime - descendDuration - pauseDuration) / ascendDuration;
        return 0.5 + (t * 0.5);
    }
}
