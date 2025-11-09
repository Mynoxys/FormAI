import { PoseLandmarks } from '../types';
import { calculateKneeAngle, calculateHipAngle, calculateTorsoAngle, checkKneeCaveIn, checkKneesOverToes } from './poseUtils';

export type SquatPhase = 'standing' | 'descending' | 'bottom' | 'ascending';

export interface FormAnalysis {
    kneeAngle: number;
    hipAngle: number;
    torsoAngle: number;
    depth: number;
    kneeAlignment: boolean;
    kneesOverToes: boolean;
    overallScore: number;
    feedback: string[];
}

export interface RepData {
    phase: SquatPhase;
    hipHeight: number;
    lowestHipHeight: number;
    startTime: number;
    formScores: number[];
}

const STANDING_KNEE_THRESHOLD = 160;
const BOTTOM_KNEE_THRESHOLD = 100;
const MIN_DESCENT_DISTANCE = 0.15;
const DEBOUNCE_FRAMES = 5;

export class SquatDetector {
    private phase: SquatPhase = 'standing';
    private repCount: number = 0;
    private lowestHipHeight: number = 1;
    private highestHipHeight: number = 0;
    private phaseFrameCount: number = 0;
    private startTime: number = 0;
    private formScores: number[] = [];
    private repStartTime: number = 0;

    reset() {
        this.phase = 'standing';
        this.repCount = 0;
        this.lowestHipHeight = 1;
        this.highestHipHeight = 0;
        this.phaseFrameCount = 0;
        this.startTime = Date.now();
        this.formScores = [];
        this.repStartTime = 0;
    }

    analyzeForm(pose: PoseLandmarks): FormAnalysis {
        const feedback: string[] = [];
        let totalScore = 100;

        const leftKneeAngle = calculateKneeAngle(pose.LEFT_HIP, pose.LEFT_KNEE, pose.LEFT_ANKLE);
        const rightKneeAngle = calculateKneeAngle(pose.RIGHT_HIP, pose.RIGHT_KNEE, pose.RIGHT_ANKLE);
        const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        const leftHipAngle = calculateHipAngle(pose.LEFT_SHOULDER, pose.LEFT_HIP, pose.LEFT_KNEE);
        const rightHipAngle = calculateHipAngle(pose.RIGHT_SHOULDER, pose.RIGHT_HIP, pose.RIGHT_KNEE);
        const hipAngle = (leftHipAngle + rightHipAngle) / 2;

        const leftTorsoAngle = calculateTorsoAngle(pose.LEFT_SHOULDER, pose.LEFT_HIP);
        const rightTorsoAngle = calculateTorsoAngle(pose.RIGHT_SHOULDER, pose.RIGHT_HIP);
        const torsoAngle = (leftTorsoAngle + rightTorsoAngle) / 2;

        const hipHeight = (pose.LEFT_HIP.y + pose.RIGHT_HIP.y) / 2;
        const kneeHeight = (pose.LEFT_KNEE.y + pose.RIGHT_KNEE.y) / 2;
        const depth = Math.max(0, Math.min(100, ((hipHeight - kneeHeight) / 0.3) * 100));

        const kneesCavedIn = checkKneeCaveIn(pose.LEFT_KNEE, pose.RIGHT_KNEE, pose.LEFT_ANKLE, pose.RIGHT_ANKLE);
        const leftKneeOverToes = checkKneesOverToes(pose.LEFT_KNEE, pose.LEFT_ANKLE);
        const rightKneeOverToes = checkKneesOverToes(pose.RIGHT_KNEE, pose.RIGHT_ANKLE);

        if (this.phase === 'bottom' || this.phase === 'descending') {
            if (hipHeight > kneeHeight - 0.05) {
                feedback.push('Go deeper - hips below knees');
                totalScore -= 15;
            }
        }

        if (kneesCavedIn) {
            feedback.push('Push knees outward');
            totalScore -= 20;
        }

        if (leftKneeOverToes || rightKneeOverToes) {
            feedback.push('Keep knees behind toes');
            totalScore -= 15;
        }

        if (torsoAngle > 30) {
            feedback.push('Keep chest up');
            totalScore -= 15;
        }

        if (hipAngle < 30 && this.phase === 'bottom') {
            feedback.push('Engage hips more');
            totalScore -= 10;
        }

        return {
            kneeAngle,
            hipAngle,
            torsoAngle,
            depth,
            kneeAlignment: !kneesCavedIn,
            kneesOverToes: leftKneeOverToes || rightKneeOverToes,
            overallScore: Math.max(0, totalScore),
            feedback
        };
    }

    detectPhase(pose: PoseLandmarks): { phase: SquatPhase; repCompleted: boolean; repDuration: number } {
        const leftKneeAngle = calculateKneeAngle(pose.LEFT_HIP, pose.LEFT_KNEE, pose.LEFT_ANKLE);
        const rightKneeAngle = calculateKneeAngle(pose.RIGHT_HIP, pose.RIGHT_KNEE, pose.RIGHT_ANKLE);
        const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        const hipHeight = (pose.LEFT_HIP.y + pose.RIGHT_HIP.y) / 2;

        if (this.highestHipHeight === 0) {
            this.highestHipHeight = hipHeight;
        }

        this.phaseFrameCount++;
        let repCompleted = false;
        let repDuration = 0;

        const oldPhase = this.phase;

        if (this.phase === 'standing') {
            if (avgKneeAngle < STANDING_KNEE_THRESHOLD && this.phaseFrameCount > DEBOUNCE_FRAMES) {
                this.phase = 'descending';
                this.lowestHipHeight = hipHeight;
                this.phaseFrameCount = 0;
                this.repStartTime = Date.now();
                this.formScores = [];
            }
        } else if (this.phase === 'descending') {
            if (hipHeight < this.lowestHipHeight) {
                this.lowestHipHeight = hipHeight;
            }

            if (avgKneeAngle < BOTTOM_KNEE_THRESHOLD && this.phaseFrameCount > DEBOUNCE_FRAMES) {
                const descentDistance = this.highestHipHeight - this.lowestHipHeight;
                if (descentDistance >= MIN_DESCENT_DISTANCE) {
                    this.phase = 'bottom';
                    this.phaseFrameCount = 0;
                }
            }
        } else if (this.phase === 'bottom') {
            if (avgKneeAngle > BOTTOM_KNEE_THRESHOLD + 10 && this.phaseFrameCount > DEBOUNCE_FRAMES) {
                this.phase = 'ascending';
                this.phaseFrameCount = 0;
            }
        } else if (this.phase === 'ascending') {
            if (avgKneeAngle > STANDING_KNEE_THRESHOLD && this.phaseFrameCount > DEBOUNCE_FRAMES) {
                const descentDistance = this.highestHipHeight - this.lowestHipHeight;
                if (descentDistance >= MIN_DESCENT_DISTANCE) {
                    this.repCount++;
                    repCompleted = true;
                    repDuration = Date.now() - this.repStartTime;
                }
                this.phase = 'standing';
                this.highestHipHeight = hipHeight;
                this.phaseFrameCount = 0;
            }
        }

        return { phase: this.phase, repCompleted, repDuration };
    }

    getRepCount(): number {
        return this.repCount;
    }

    getCurrentPhase(): SquatPhase {
        return this.phase;
    }

    addFormScore(score: number) {
        this.formScores.push(score);
    }

    getAverageFormScore(): number {
        if (this.formScores.length === 0) return 0;
        return this.formScores.reduce((a, b) => a + b, 0) / this.formScores.length;
    }
}
