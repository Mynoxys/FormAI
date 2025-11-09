import { Landmark, PoseLandmarks } from '../types';

export const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
    if (!a || !b || !c) return 0;

    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
        angle = 360 - angle;
    }

    return angle;
};

export const calculateKneeAngle = (hip: Landmark, knee: Landmark, ankle: Landmark): number => {
    return calculateAngle(hip, knee, ankle);
};

export const calculateHipAngle = (shoulder: Landmark, hip: Landmark, knee: Landmark): number => {
    return calculateAngle(shoulder, hip, knee);
};

export const calculateTorsoAngle = (shoulder: Landmark, hip: Landmark): number => {
    const deltaY = hip.y - shoulder.y;
    const deltaX = hip.x - shoulder.x;
    const angleRad = Math.atan2(deltaY, deltaX);
    const angleDeg = angleRad * 180 / Math.PI;
    return Math.abs(90 - Math.abs(angleDeg));
};

export const checkKneeCaveIn = (leftKnee: Landmark, rightKnee: Landmark, leftAnkle: Landmark, rightAnkle: Landmark): boolean => {
    const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
    const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);
    return kneeWidth < ankleWidth * 0.9;
};

export const checkKneesOverToes = (knee: Landmark, ankle: Landmark): boolean => {
    return knee.x > ankle.x + 0.05;
};

const interpolateLandmarks = (start: Landmark, end: Landmark, t: number): Landmark => {
    return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t,
        visibility: (start.visibility ?? 1 + ((end.visibility ?? 1) - (start.visibility ?? 1))) * t,
    };
};

export const interpolatePose = (
    startPose: Record<string, Landmark>, 
    endPose: Record<string, Landmark>, 
    t: number
): Partial<PoseLandmarks> => {
    const interpolated: Partial<PoseLandmarks> = {};
    for (const key in startPose) {
        if (endPose[key]) {
            interpolated[key as keyof PoseLandmarks] = interpolateLandmarks(startPose[key], endPose[key], t);
        }
    }
    return interpolated;
};

const getCenter = (lm1: Landmark, lm2: Landmark) => ({ x: (lm1.x + lm2.x) / 2, y: (lm1.y + lm2.y) / 2 });

// Normalizes a pose by centering it on the hips and scaling by torso height
const normalizePoseForComparison = (pose: PoseLandmarks | Partial<PoseLandmarks>): Partial<PoseLandmarks> | null => {
    const hipL = pose.LEFT_HIP;
    const hipR = pose.RIGHT_HIP;
    const shoulderL = pose.LEFT_SHOULDER;
    const shoulderR = pose.RIGHT_SHOULDER;

    if (!hipL || !hipR || !shoulderL || !shoulderR) return null;

    const hipCenter = getCenter(hipL, hipR);
    const shoulderCenter = getCenter(shoulderL, shoulderR);
    
    const torsoHeight = Math.hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y);
    if (torsoHeight < 0.01) return null; // Avoid division by zero

    const normalized: Partial<PoseLandmarks> = {};
    for (const key in pose) {
        const lm = pose[key as keyof PoseLandmarks];
        if (lm) {
            normalized[key as keyof PoseLandmarks] = {
                ...lm,
                x: (lm.x - hipCenter.x) / torsoHeight,
                y: (lm.y - hipCenter.y) / torsoHeight,
            };
        }
    }
    return normalized;
};


export const calculatePoseSimilarity = (
    userPose: PoseLandmarks,
    coachPose: Partial<PoseLandmarks>,
    relevantLandmarks: (keyof PoseLandmarks)[],
): number => {
    const normalizedUser = normalizePoseForComparison(userPose);
    const normalizedCoach = normalizePoseForComparison(coachPose);

    if (!normalizedUser || !normalizedCoach) return 0;

    let totalDistance = 0;
    let landmarkCount = 0;

    relevantLandmarks.forEach(key => {
        const userLm = normalizedUser[key];
        const coachLm = normalizedCoach[key];
        if (userLm && coachLm && (userPose[key].visibility ?? 0) > 0.5) {
            const distance = Math.hypot(userLm.x - coachLm.x, userLm.y - coachLm.y);
            totalDistance += distance;
            landmarkCount++;
        }
    });

    if (landmarkCount === 0) return 0;

    const averageDistance = totalDistance / landmarkCount;

    const similarity = Math.max(0, 100 * (1 - averageDistance / 0.25));

    return Math.round(similarity);
};

export const centerPoseInCanvas = (
    pose: Partial<PoseLandmarks>,
    canvasWidth: number,
    canvasHeight: number,
    scale: number = 1
): Partial<PoseLandmarks> => {
    if (!pose.LEFT_HIP || !pose.RIGHT_HIP || !pose.LEFT_SHOULDER || !pose.RIGHT_SHOULDER) {
        return pose;
    }

    const hipCenterX = (pose.LEFT_HIP.x + pose.RIGHT_HIP.x) / 2;
    const hipCenterY = (pose.LEFT_HIP.y + pose.RIGHT_HIP.y) / 2;
    const shoulderCenterY = (pose.LEFT_SHOULDER.y + pose.RIGHT_SHOULDER.y) / 2;

    const poseHeight = Math.abs(hipCenterY - shoulderCenterY);
    const targetHeight = canvasHeight * 0.6;
    const scaleFactor = poseHeight > 0 ? targetHeight / poseHeight : 1;

    const minX = Math.min(...Object.values(pose).filter(lm => lm).map(lm => lm!.x));
    const maxX = Math.max(...Object.values(pose).filter(lm => lm).map(lm => lm!.x));
    const minY = Math.min(...Object.values(pose).filter(lm => lm).map(lm => lm!.y));
    const maxY = Math.max(...Object.values(pose).filter(lm => lm).map(lm => lm!.y));

    const poseWidth = maxX - minX;
    const poseCenterX = (minX + maxX) / 2;
    const poseCenterY = (minY + maxY) / 2;

    const centeredPose: Partial<PoseLandmarks> = {};

    for (const key in pose) {
        const lm = pose[key as keyof PoseLandmarks];
        if (lm) {
            const scaledX = (lm.x - poseCenterX) * scaleFactor * scale;
            const scaledY = (lm.y - poseCenterY) * scaleFactor * scale;

            centeredPose[key as keyof PoseLandmarks] = {
                ...lm,
                x: scaledX + canvasWidth / 2,
                y: scaledY + canvasHeight / 2
            };
        }
    }

    return centeredPose;
};
