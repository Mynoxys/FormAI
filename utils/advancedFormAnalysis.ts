import { PoseLandmarks, Landmark } from '../types';
import { BiomechanicalSquatPose, SquatKeyframe } from './squatBiomechanics';
import { calculateKneeAngle, calculateHipAngle, calculateTorsoAngle } from './poseUtils';

export interface DetailedFormAnalysis {
    overallScore: number;
    kneeScore: number;
    hipScore: number;
    torsoScore: number;
    ankleScore: number;
    depthScore: number;
    alignment: AlignmentAnalysis;
    timing: TimingAnalysis;
    feedback: FeedbackItem[];
}

export interface AlignmentAnalysis {
    kneeValgus: boolean;
    kneesOverToes: boolean;
    spineNeutral: boolean;
    weightDistribution: 'centered' | 'forward' | 'backward';
}

export interface TimingAnalysis {
    currentPhase: 'standing' | 'descending' | 'bottom' | 'ascending';
    phaseDuration: number;
    movementSpeed: 'too_fast' | 'optimal' | 'too_slow';
}

export interface FeedbackItem {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    joint: string;
    expectedAngle?: number;
    actualAngle?: number;
}

function calculateAngleDifference(angle1: number, angle2: number): number {
    return Math.abs(angle1 - angle2);
}

function calculateLandmarkDistance(lm1: Landmark, lm2: Landmark): number {
    return Math.sqrt(
        Math.pow(lm1.x - lm2.x, 2) +
        Math.pow(lm1.y - lm2.y, 2) +
        Math.pow((lm1.z || 0) - (lm2.z || 0), 2)
    );
}

export function analyzeFormAgainstCoach(
    userPose: PoseLandmarks,
    coachPose: BiomechanicalSquatPose,
    targetKeyframe: SquatKeyframe
): DetailedFormAnalysis {
    const feedback: FeedbackItem[] = [];
    let totalScore = 100;

    const userLeftKneeAngle = calculateKneeAngle(
        userPose.LEFT_HIP,
        userPose.LEFT_KNEE,
        userPose.LEFT_ANKLE
    );
    const userRightKneeAngle = calculateKneeAngle(
        userPose.RIGHT_HIP,
        userPose.RIGHT_KNEE,
        userPose.RIGHT_ANKLE
    );
    const userKneeAngle = (userLeftKneeAngle + userRightKneeAngle) / 2;

    const kneeDiff = calculateAngleDifference(userKneeAngle, targetKeyframe.kneeAngle);
    let kneeScore = Math.max(0, 100 - (kneeDiff * 2));

    if (kneeDiff > 20) {
        feedback.push({
            severity: 'critical',
            message: `Knee angle off by ${kneeDiff.toFixed(0)}° - ${userKneeAngle < targetKeyframe.kneeAngle ? 'Squat deeper' : 'Don\'t go as deep'}`,
            joint: 'knee',
            expectedAngle: targetKeyframe.kneeAngle,
            actualAngle: userKneeAngle
        });
        totalScore -= 15;
    } else if (kneeDiff > 10) {
        feedback.push({
            severity: 'warning',
            message: 'Adjust knee depth to match coach',
            joint: 'knee',
            expectedAngle: targetKeyframe.kneeAngle,
            actualAngle: userKneeAngle
        });
        totalScore -= 8;
    }

    const userLeftHipAngle = calculateHipAngle(
        userPose.LEFT_SHOULDER,
        userPose.LEFT_HIP,
        userPose.LEFT_KNEE
    );
    const userRightHipAngle = calculateHipAngle(
        userPose.RIGHT_SHOULDER,
        userPose.RIGHT_HIP,
        userPose.RIGHT_KNEE
    );
    const userHipAngle = (userLeftHipAngle + userRightHipAngle) / 2;

    const hipDiff = calculateAngleDifference(userHipAngle, targetKeyframe.hipAngle);
    let hipScore = Math.max(0, 100 - (hipDiff * 2));

    if (hipDiff > 20) {
        feedback.push({
            severity: 'critical',
            message: `Hip angle off - ${userHipAngle < targetKeyframe.hipAngle ? 'Engage hips more' : 'Reduce hip flexion'}`,
            joint: 'hip',
            expectedAngle: targetKeyframe.hipAngle,
            actualAngle: userHipAngle
        });
        totalScore -= 12;
    } else if (hipDiff > 10) {
        feedback.push({
            severity: 'warning',
            message: 'Adjust hip position',
            joint: 'hip'
        });
        totalScore -= 6;
    }

    const userLeftTorsoAngle = calculateTorsoAngle(
        userPose.LEFT_SHOULDER,
        userPose.LEFT_HIP
    );
    const userRightTorsoAngle = calculateTorsoAngle(
        userPose.RIGHT_SHOULDER,
        userPose.RIGHT_HIP
    );
    const userTorsoAngle = (userLeftTorsoAngle + userRightTorsoAngle) / 2;

    const torsoDiff = calculateAngleDifference(userTorsoAngle, targetKeyframe.torsoAngle);
    let torsoScore = Math.max(0, 100 - (torsoDiff * 2.5));

    if (userTorsoAngle > 60) {
        feedback.push({
            severity: 'critical',
            message: 'Keep chest up - excessive forward lean',
            joint: 'torso',
            expectedAngle: targetKeyframe.torsoAngle,
            actualAngle: userTorsoAngle
        });
        totalScore -= 15;
    } else if (torsoDiff > 15) {
        feedback.push({
            severity: 'warning',
            message: userTorsoAngle > targetKeyframe.torsoAngle ? 'Chest up more' : 'Lean forward slightly',
            joint: 'torso'
        });
        totalScore -= 8;
    }

    const userHipHeight = (userPose.LEFT_HIP.y + userPose.RIGHT_HIP.y) / 2;
    const userKneeHeight = (userPose.LEFT_KNEE.y + userPose.RIGHT_KNEE.y) / 2;
    const userAnkleHeight = (userPose.LEFT_ANKLE.y + userPose.RIGHT_ANKLE.y) / 2;

    let depthScore = 100;
    const ankleScore = 100;

    if (targetKeyframe.progress > 0.4 && targetKeyframe.progress < 0.6) {
        if (userHipHeight < userKneeHeight) {
            depthScore = 100;
        } else {
            const depthDeficit = (userHipHeight - userKneeHeight) * 100;
            depthScore = Math.max(0, 100 - depthDeficit);
            feedback.push({
                severity: 'critical',
                message: 'Go deeper - hips must drop below knees',
                joint: 'hip'
            });
            totalScore -= 20;
        }
    }

    const kneeWidth = Math.abs(userPose.LEFT_KNEE.x - userPose.RIGHT_KNEE.x);
    const ankleWidth = Math.abs(userPose.LEFT_ANKLE.x - userPose.RIGHT_ANKLE.x);
    const kneeValgus = kneeWidth < ankleWidth * 0.8;

    if (kneeValgus) {
        feedback.push({
            severity: 'critical',
            message: 'Push knees outward - prevent knee cave',
            joint: 'knee'
        });
        totalScore -= 20;
    }

    const leftKneeOverToes = userPose.LEFT_KNEE.x > userPose.LEFT_ANKLE.x + 0.05;
    const rightKneeOverToes = userPose.RIGHT_KNEE.x < userPose.RIGHT_ANKLE.x - 0.05;
    const kneesOverToes = leftKneeOverToes || rightKneeOverToes;

    if (kneesOverToes) {
        feedback.push({
            severity: 'warning',
            message: 'Knees tracking too far forward',
            joint: 'knee'
        });
        totalScore -= 10;
    }

    const spineNeutral = userTorsoAngle < 60 && userTorsoAngle > 0;

    const avgX = (userPose.LEFT_ANKLE.x + userPose.RIGHT_ANKLE.x) / 2;
    const hipX = (userPose.LEFT_HIP.x + userPose.RIGHT_HIP.x) / 2;
    const weightDistribution: 'centered' | 'forward' | 'backward' =
        Math.abs(hipX - avgX) < 0.05 ? 'centered' :
        hipX > avgX ? 'forward' : 'backward';

    if (weightDistribution !== 'centered') {
        feedback.push({
            severity: 'warning',
            message: `Weight too far ${weightDistribution} - center over mid-foot`,
            joint: 'balance'
        });
        totalScore -= 8;
    }

    const alignment: AlignmentAnalysis = {
        kneeValgus,
        kneesOverToes,
        spineNeutral,
        weightDistribution
    };

    const timing: TimingAnalysis = {
        currentPhase: targetKeyframe.progress < 0.25 ? 'descending' :
                      targetKeyframe.progress < 0.55 ? 'bottom' :
                      targetKeyframe.progress < 0.95 ? 'ascending' : 'standing',
        phaseDuration: 0,
        movementSpeed: 'optimal'
    };

    totalScore = Math.max(0, Math.min(100, totalScore));

    return {
        overallScore: Math.round(totalScore),
        kneeScore: Math.round(kneeScore),
        hipScore: Math.round(hipScore),
        torsoScore: Math.round(torsoScore),
        ankleScore: Math.round(ankleScore),
        depthScore: Math.round(depthScore),
        alignment,
        timing,
        feedback: feedback.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        })
    };
}

export function calculateMovementQuality(
    formScores: number[],
    repDurations: number[]
): {
    averageForm: number;
    consistency: number;
    tempo: 'too_fast' | 'optimal' | 'too_slow';
    recommendation: string;
} {
    if (formScores.length === 0) {
        return {
            averageForm: 0,
            consistency: 0,
            tempo: 'optimal',
            recommendation: 'Keep practicing to establish baseline'
        };
    }

    const averageForm = formScores.reduce((a, b) => a + b, 0) / formScores.length;

    const variance = formScores.reduce((sum, score) => {
        return sum + Math.pow(score - averageForm, 2);
    }, 0) / formScores.length;
    const standardDeviation = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (standardDeviation * 2));

    let tempo: 'too_fast' | 'optimal' | 'too_slow' = 'optimal';
    if (repDurations.length > 0) {
        const avgDuration = repDurations.reduce((a, b) => a + b, 0) / repDurations.length;
        if (avgDuration < 3000) tempo = 'too_fast';
        else if (avgDuration > 7000) tempo = 'too_slow';
    }

    let recommendation = '';
    if (averageForm < 60) {
        recommendation = 'Focus on form over speed - reduce weight if needed';
    } else if (averageForm < 80) {
        recommendation = 'Good progress - refine depth and alignment';
    } else if (consistency < 70) {
        recommendation = 'Great form - work on consistency across reps';
    } else {
        recommendation = 'Excellent form and consistency - consider adding weight';
    }

    if (tempo === 'too_fast') {
        recommendation += ' | Slow down your descent (2-3 seconds)';
    } else if (tempo === 'too_slow') {
        recommendation += ' | Speed up slightly while maintaining control';
    }

    return {
        averageForm: Math.round(averageForm),
        consistency: Math.round(consistency),
        tempo,
        recommendation
    };
}
