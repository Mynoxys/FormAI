import React, { useRef, useEffect, useState, useCallback } from 'react';
import { interpolatePose, centerPoseInCanvas } from '../utils/poseUtils';
import { PoseLandmarks, Feedback, ExerciseType, Landmark } from '../types';
import { generateSpeech } from '../services/geminiService';
import { ChevronLeftIcon } from './Icons';
import { SquatDetector, SquatPhase } from '../utils/squatAnalysis';
import { createRealisticSquatAnimation } from '../utils/animationUtils';
import {
    SQUAT_KEYFRAMES,
    generateBiomechanicalSquatPose,
    interpolateKeyframes,
    calculateSquatProgress
} from '../utils/squatBiomechanics';
import { drawCoachModel, drawPhaseIndicator } from '../utils/coachRenderer';
import { analyzeFormAgainstCoach, calculateMovementQuality } from '../utils/advancedFormAnalysis';
import { CameraAngle, getCameraForSquatPhase, CAMERA_PRESETS } from '../utils/cameraSystem';

declare global {
    interface Window {
        Pose: any;
        drawConnectors: any;
        POSE_CONNECTIONS: any;
        drawLandmarks: any;
        Camera: any;
    }
}

const landmarkNames = [
    'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
    'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW',
    'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY', 'LEFT_INDEX', 'RIGHT_INDEX',
    'LEFT_THUMB', 'RIGHT_THUMB', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE',
    'RIGHT_ANKLE', 'LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
];

const BODY_LANDMARK_INDICES = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BODY_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23],
    [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
];

const createNormalizedPose = (poseData: Record<string, {x: number, y: number}>): Record<string, Landmark> => {
    const pose: Record<string, Landmark> = {};
    for(const key in poseData) {
        pose[key] = { ...poseData[key], z: 0, visibility: 1 };
    }
    return pose;
}

const EXERCISE_CONFIG: Record<ExerciseType, any> = {
    squat: {
        name: 'Squats',
        upPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.45, y: 0.25 }, RIGHT_SHOULDER: { x: 0.55, y: 0.25 },
            LEFT_HIP: { x: 0.45, y: 0.45 }, RIGHT_HIP: { x: 0.55, y: 0.45 },
            LEFT_KNEE: { x: 0.45, y: 0.7 }, RIGHT_KNEE: { x: 0.55, y: 0.7 },
            LEFT_ANKLE: { x: 0.45, y: 0.95 }, RIGHT_ANKLE: { x: 0.55, y: 0.95 },
            LEFT_ELBOW: { x: 0.35, y: 0.35 }, RIGHT_ELBOW: { x: 0.65, y: 0.35 },
            LEFT_WRIST: { x: 0.3, y: 0.45 }, RIGHT_WRIST: { x: 0.7, y: 0.45 },
            LEFT_EAR: { x: 0.47, y: 0.18 }, RIGHT_EAR: { x: 0.53, y: 0.18 }
        }),
        downPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.45, y: 0.4 }, RIGHT_SHOULDER: { x: 0.55, y: 0.4 },
            LEFT_HIP: { x: 0.45, y: 0.65 }, RIGHT_HIP: { x: 0.55, y: 0.65 },
            LEFT_KNEE: { x: 0.42, y: 0.8 }, RIGHT_KNEE: { x: 0.58, y: 0.8 },
            LEFT_ANKLE: { x: 0.4, y: 0.95 }, RIGHT_ANKLE: { x: 0.6, y: 0.95 },
            LEFT_ELBOW: { x: 0.35, y: 0.5 }, RIGHT_ELBOW: { x: 0.65, y: 0.5 },
            LEFT_WRIST: { x: 0.3, y: 0.6 }, RIGHT_WRIST: { x: 0.7, y: 0.6 },
            LEFT_EAR: { x: 0.47, y: 0.32 }, RIGHT_EAR: { x: 0.53, y: 0.32 }
        }),
        relevantLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE']
    },
    pushup: {
        name: 'Push-ups',
        upPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.3, y: 0.5 }, RIGHT_SHOULDER: { x: 0.3, y: 0.5 },
            LEFT_HIP: { x: 0.5, y: 0.5 }, RIGHT_HIP: { x: 0.5, y: 0.5 },
            LEFT_KNEE: { x: 0.7, y: 0.5 }, RIGHT_KNEE: { x: 0.7, y: 0.5 },
            LEFT_ANKLE: { x: 0.9, y: 0.5 }, RIGHT_ANKLE: { x: 0.9, y: 0.5 },
            LEFT_ELBOW: { x: 0.3, y: 0.65 }, RIGHT_ELBOW: { x: 0.3, y: 0.65 },
            LEFT_WRIST: { x: 0.3, y: 0.8 }, RIGHT_WRIST: { x: 0.3, y: 0.8 },
            LEFT_EAR: { x: 0.25, y: 0.45 }, RIGHT_EAR: { x: 0.25, y: 0.45 },
        }),
        downPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.3, y: 0.7 }, RIGHT_SHOULDER: { x: 0.3, y: 0.7 },
            LEFT_HIP: { x: 0.5, y: 0.7 }, RIGHT_HIP: { x: 0.5, y: 0.7 },
            LEFT_KNEE: { x: 0.7, y: 0.7 }, RIGHT_KNEE: { x: 0.7, y: 0.7 },
            LEFT_ANKLE: { x: 0.9, y: 0.7 }, RIGHT_ANKLE: { x: 0.9, y: 0.7 },
            LEFT_ELBOW: { x: 0.4, y: 0.75 }, RIGHT_ELBOW: { x: 0.4, y: 0.75 },
            LEFT_WRIST: { x: 0.3, y: 0.8 }, RIGHT_WRIST: { x: 0.3, y: 0.8 },
            LEFT_EAR: { x: 0.25, y: 0.65 }, RIGHT_EAR: { x: 0.25, y: 0.65 },
        }),
        relevantLandmarks: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST', 'LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE']
    }
};

const drawPositioningGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();

    const margin = 40;
    const guideX = margin;
    const guideY = margin;
    const guideWidth = width - (margin * 2);
    const guideHeight = height - (margin * 2);

    ctx.strokeStyle = 'rgba(0, 217, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);
    ctx.setLineDash([]);

    const cornerLength = 30;
    ctx.strokeStyle = '#00D9FF';
    ctx.lineWidth = 4;

    [[guideX, guideY], [guideX + guideWidth, guideY], [guideX, guideY + guideHeight], [guideX + guideWidth, guideY + guideHeight]].forEach(([x, y], i) => {
        ctx.beginPath();
        if (i === 0) {
            ctx.moveTo(x, y + cornerLength);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLength, y);
        } else if (i === 1) {
            ctx.moveTo(x - cornerLength, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + cornerLength);
        } else if (i === 2) {
            ctx.moveTo(x, y - cornerLength);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLength, y);
        } else {
            ctx.moveTo(x - cornerLength, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y - cornerLength);
        }
        ctx.stroke();
    });

    ctx.fillStyle = 'rgba(0, 217, 255, 0.9)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Position your full body within the frame', width / 2, 25);

    const silhouetteHeight = guideHeight * 0.7;
    const silhouetteY = guideY + (guideHeight - silhouetteHeight) / 2;
    const centerX = width / 2;

    ctx.strokeStyle = 'rgba(0, 217, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const headRadius = silhouetteHeight * 0.08;
    const headY = silhouetteY + headRadius;
    ctx.beginPath();
    ctx.arc(centerX, headY, headRadius, 0, 2 * Math.PI);
    ctx.stroke();

    const shoulderY = headY + headRadius + 10;
    const shoulderWidth = silhouetteHeight * 0.15;
    ctx.beginPath();
    ctx.moveTo(centerX - shoulderWidth, shoulderY);
    ctx.lineTo(centerX + shoulderWidth, shoulderY);
    ctx.stroke();

    const hipY = shoulderY + silhouetteHeight * 0.25;
    ctx.beginPath();
    ctx.moveTo(centerX, shoulderY);
    ctx.lineTo(centerX, hipY);
    ctx.stroke();

    const hipWidth = silhouetteHeight * 0.12;
    ctx.beginPath();
    ctx.moveTo(centerX - hipWidth, hipY);
    ctx.lineTo(centerX + hipWidth, hipY);
    ctx.stroke();

    const kneeY = hipY + silhouetteHeight * 0.22;
    ctx.beginPath();
    ctx.moveTo(centerX - hipWidth, hipY);
    ctx.lineTo(centerX - hipWidth, kneeY);
    ctx.moveTo(centerX + hipWidth, hipY);
    ctx.lineTo(centerX + hipWidth, kneeY);
    ctx.stroke();

    const ankleY = silhouetteY + silhouetteHeight - 10;
    ctx.beginPath();
    ctx.moveTo(centerX - hipWidth, kneeY);
    ctx.lineTo(centerX - hipWidth, ankleY);
    ctx.moveTo(centerX + hipWidth, kneeY);
    ctx.lineTo(centerX + hipWidth, ankleY);
    ctx.stroke();

    ctx.restore();
};

const drawStickman = (ctx: CanvasRenderingContext2D, pose: Partial<PoseLandmarks>, color: string) => {
    const landmarkList = landmarkNames.map(name => pose[name as keyof PoseLandmarks]);

    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    if (window.drawConnectors) {
        window.drawConnectors(ctx, landmarkList, BODY_CONNECTIONS, { color, lineWidth: 8 });
    }

    const leftShoulder = landmarkList[11];
    const rightShoulder = landmarkList[12];
    const leftEar = landmarkList[7];
    const rightEar = landmarkList[8];

    if (leftShoulder && rightShoulder) {
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const headRadius = shoulderWidth > 10 ? shoulderWidth * 0.5 : 25;
        const headCenterY = (leftEar && rightEar) ? (leftEar.y + rightEar.y) / 2 : shoulderCenterY - headRadius * 1.5;
        ctx.beginPath();
        ctx.arc(shoulderCenterX, headCenterY, headRadius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill('nonzero');
    }
};

const ExerciseTracker: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const coachCanvasRef = useRef<HTMLCanvasElement>(null);

    const [feedback, setFeedback] = useState<Feedback>({ message: 'Select an exercise!', type: 'info' });
    const [formMatch, setFormMatch] = useState(0);
    const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
    const [isCoachActive, setIsCoachActive] = useState(false);
    const [repCount, setRepCount] = useState(0);
    const [currentPhase, setCurrentPhase] = useState<SquatPhase>('standing');
    const [currentSet, setCurrentSet] = useState(1);
    const [targetReps] = useState(10);

    const poseRef = useRef<any>(null);
    const coachAnimationIdRef = useRef<number>();
    const lastPoseRef = useRef<PoseLandmarks | null>(null);
    const genericCoachPoseRef = useRef<Partial<PoseLandmarks>>({});
    const lastSpokenMsgRef = useRef('');
    const speakTimeoutRef = useRef<NodeJS.Timeout>();
    const onResultsLogicRef = useRef((_results: any) => {});
    const squatDetectorRef = useRef(new SquatDetector());
    const [currentKeyframeName, setCurrentKeyframeName] = useState('Standing');
    const repDurationsRef = useRef<number[]>([]);
    const formScoresRef = useRef<number[]>([]);
    const [cameraAngle, setCameraAngle] = useState<CameraAngle>('dynamic');
    const [showCameraControls, setShowCameraControls] = useState(false);

    const speakFeedback = useCallback(async (message: string) => {
        if (message && message !== lastSpokenMsgRef.current) {
            lastSpokenMsgRef.current = message;
            await generateSpeech(message);
            if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
            speakTimeoutRef.current = setTimeout(() => { lastSpokenMsgRef.current = ''; }, 3000);
        }
    }, []);

    useEffect(() => {
        onResultsLogicRef.current = (results: any) => {
            if (!canvasRef.current || !videoRef.current) return;
            const canvasCtx = canvasRef.current.getContext('2d');
            const canvas = canvasRef.current;
            if (!canvasCtx) return;

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

            if (!isCoachActive) {
                drawPositioningGuide(canvasCtx, canvas.width, canvas.height);
            }

            if (results.poseLandmarks) {
                const allLandmarks = results.poseLandmarks;
                const bodyLandmarks = BODY_LANDMARK_INDICES.map(i => allLandmarks[i]);
                window.drawConnectors(canvasCtx, allLandmarks, BODY_CONNECTIONS, { color: '#10B981', lineWidth: 4 });
                window.drawLandmarks(canvasCtx, bodyLandmarks, { color: '#3B82F6', radius: 5 });

                const landmarks: PoseLandmarks = allLandmarks.reduce((acc: any, lm: any, i: number) => {
                    acc[landmarkNames[i]] = lm;
                    return acc;
                }, {} as PoseLandmarks);
                lastPoseRef.current = landmarks;

                if(isCoachActive && selectedExercise === 'squat') {
                    const detector = squatDetectorRef.current;
                    const { phase, repCompleted, repDuration } = detector.detectPhase(landmarks);

                    setCurrentPhase(phase);

                    if (repCompleted) {
                        const newRepCount = detector.getRepCount();
                        setRepCount(newRepCount);
                        repDurationsRef.current.push(repDuration);
                        speakFeedback(`${newRepCount} reps`);

                        if (newRepCount >= targetReps) {
                            speakFeedback(`Set ${currentSet} complete!`);
                        }
                    }

                    if (genericCoachPoseRef.current && Object.keys(genericCoachPoseRef.current).length > 0) {
                        const timestamp = Date.now();
                        const progress = calculateSquatProgress(timestamp, 6000);
                        const currentKeyframe = interpolateKeyframes(SQUAT_KEYFRAMES, progress);
                        const biomechanicalPose = generateBiomechanicalSquatPose(currentKeyframe);

                        const advancedAnalysis = analyzeFormAgainstCoach(
                            landmarks,
                            biomechanicalPose,
                            currentKeyframe
                        );

                        setFormMatch(advancedAnalysis.overallScore);
                        formScoresRef.current.push(advancedAnalysis.overallScore);
                        if (formScoresRef.current.length > 100) {
                            formScoresRef.current = formScoresRef.current.slice(-100);
                        }

                        if (advancedAnalysis.feedback.length > 0) {
                            const primaryFeedback = advancedAnalysis.feedback[0];
                            setFeedback({
                                message: primaryFeedback.message,
                                type: primaryFeedback.severity === 'critical' ? 'warning' : 'info'
                            });
                            if (primaryFeedback.severity === 'critical') {
                                speakFeedback(primaryFeedback.message);
                            }
                        } else {
                            if (phase === 'standing') {
                                setFeedback({ message: 'Excellent form - Ready for next rep', type: 'success' });
                            } else if (phase === 'descending') {
                                setFeedback({ message: 'Perfect descent - Keep going!', type: 'success' });
                            } else if (phase === 'bottom') {
                                setFeedback({ message: 'Great depth - Drive up!', type: 'success' });
                            } else if (phase === 'ascending') {
                                setFeedback({ message: 'Strong push - Finish it!', type: 'success' });
                            }
                        }
                    }
                }
            }
            canvasCtx.restore();
        };
    }, [isCoachActive, selectedExercise, speakFeedback, currentSet, targetReps]);

    const stableOnResults = useCallback((results: any) => {
        onResultsLogicRef.current(results);
    }, []);

    const animateCoach = useCallback((timestamp: number) => {
        if (!coachCanvasRef.current || !selectedExercise) {
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
            return;
        }

        const coachCtx = coachCanvasRef.current.getContext('2d');
        const coachCanvas = coachCanvasRef.current;
        if (!coachCtx || coachCanvas.width === 0 || coachCanvas.height === 0) {
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
            return;
        }

        coachCtx.clearRect(0, 0, coachCanvas.width, coachCanvas.height);

        if (selectedExercise === 'squat') {
            const progress = calculateSquatProgress(timestamp, 6000);
            const currentKeyframe = interpolateKeyframes(SQUAT_KEYFRAMES, progress);
            const biomechanicalPose = generateBiomechanicalSquatPose(currentKeyframe);

            setCurrentKeyframeName(currentKeyframe.name);

            const camera = getCameraForSquatPhase(progress, cameraAngle);
            drawCoachModel(coachCtx, biomechanicalPose, coachCanvas.width, coachCanvas.height, '#00D9FF', camera);
            drawPhaseIndicator(coachCtx, currentKeyframe.name, progress, coachCanvas.width, coachCanvas.height);

            genericCoachPoseRef.current = biomechanicalPose as any;
        } else {
            const config = EXERCISE_CONFIG[selectedExercise];
            const t = createRealisticSquatAnimation(timestamp, 4000);
            const genericAnimatedPose = interpolatePose(config.upPose, config.downPose, t);
            genericCoachPoseRef.current = genericAnimatedPose;
            const centeredPose = centerPoseInCanvas(genericAnimatedPose, coachCanvas.width, coachCanvas.height, 1.2);
            coachCtx.clearRect(0, 0, coachCanvas.width, coachCanvas.height);
            drawStickman(coachCtx, centeredPose, '#00D9FF');
        }

        coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
    }, [selectedExercise, cameraAngle]);

    useEffect(() => {
        if (!selectedExercise) return;

        const canvas = canvasRef.current;
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        }
        const coachCanvas = coachCanvasRef.current;
        if (coachCanvas && coachCanvas.parentElement) {
            coachCanvas.width = coachCanvas.parentElement.clientWidth;
            coachCanvas.height = coachCanvas.parentElement.clientHeight;
        }

        const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(stableOnResults);
        poseRef.current = pose;

        let camera: any;
        if (videoRef.current) {
            camera = new window.Camera(videoRef.current, {
                onFrame: async () => {
                    if (videoRef.current && poseRef.current) {
                        await poseRef.current.send({ image: videoRef.current });
                    }
                },
                width: 640, height: 480
            });
            camera.start();
        }

        return () => {
            if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
            camera?.stop();
            const poseToClose = poseRef.current;
            poseRef.current = null;
            poseToClose?.close();
            if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
        };
    }, [selectedExercise, stableOnResults]);

    const handleSelectExercise = (exercise: ExerciseType) => {
        setSelectedExercise(exercise);
        setFeedback({ message: 'Position yourself and press Start!', type: 'info' });
        setRepCount(0);
        setCurrentPhase('standing');
        squatDetectorRef.current.reset();
        formScoresRef.current = [];
        repDurationsRef.current = [];
        if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
        setTimeout(() => {
            if (coachCanvasRef.current) {
                const canvas = coachCanvasRef.current;
                if (canvas.parentElement) {
                    canvas.width = canvas.parentElement.clientWidth;
                    canvas.height = canvas.parentElement.clientHeight;
                }
            }
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
        }, 100);
    };

    const handleStart = () => {
        if (lastPoseRef.current) {
            const userPose = lastPoseRef.current;
            const { LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE } = userPose;

            if (
                !LEFT_SHOULDER || !RIGHT_SHOULDER || !LEFT_HIP || !RIGHT_HIP || !LEFT_KNEE || !RIGHT_KNEE || !LEFT_ANKLE || !RIGHT_ANKLE ||
                (LEFT_SHOULDER.visibility ?? 0) < 0.6 ||
                (RIGHT_SHOULDER.visibility ?? 0) < 0.6 ||
                (LEFT_HIP.visibility ?? 0) < 0.6 ||
                (RIGHT_HIP.visibility ?? 0) < 0.6 ||
                (LEFT_KNEE.visibility ?? 0) < 0.6 ||
                (RIGHT_KNEE.visibility ?? 0) < 0.6
            ) {
                setFeedback({ message: 'Step back - I need to see your full body!', type: 'warning' });
                speakFeedback('Step back so I can see your full body');
                return;
            }

            setIsCoachActive(true);
            squatDetectorRef.current.reset();
            setRepCount(0);
            setFeedback({ message: 'Great! Follow the coach!', type: 'success' });
            speakFeedback('Go! Follow the coach');
            if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
        } else {
            setFeedback({ message: 'Cannot detect you. Check camera!', type: 'warning' });
        }
    };

    const handleStop = () => {
        setIsCoachActive(false);
        setSelectedExercise(null);
        setFeedback({ message: 'Select an exercise!', type: 'info' });
        setFormMatch(0);
        setRepCount(0);

        if (formScoresRef.current.length > 0) {
            const quality = calculateMovementQuality(formScoresRef.current, repDurationsRef.current);
            console.log('Workout Summary:', quality);
        }

        formScoresRef.current = [];
        repDurationsRef.current = [];
        if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
    };

    if (!selectedExercise) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <h2 className="text-4xl font-bold mb-12 text-white">Choose Your Exercise</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
                    {Object.entries(EXERCISE_CONFIG).map(([key, { name }]) => (
                        <button key={key} onClick={() => handleSelectExercise(key as ExerciseType)}
                            className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-10 px-6 rounded-2xl text-2xl transition-all transform hover:scale-105 shadow-2xl border-2 border-blue-400">
                            {name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const phaseColors: Record<SquatPhase, string> = {
        standing: 'bg-gray-600',
        descending: 'bg-yellow-500',
        bottom: 'bg-orange-500',
        ascending: 'bg-green-500'
    };

    const feedbackColor = { success: 'text-green-400', warning: 'text-yellow-400', info: 'text-blue-400' };

    return (
        <div className="flex-grow w-full h-full flex flex-row bg-black p-3 gap-3">
            <div className="relative w-1/2 h-full rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700">
                <video ref={videoRef} className="hidden" autoPlay playsInline></video>
                <canvas ref={canvasRef} className="w-full h-full" style={{ transform: 'scaleX(-1)' }}></canvas>
                <div className="absolute top-3 left-3 text-white bg-black bg-opacity-70 px-4 py-2 rounded-lg font-bold text-sm tracking-wide">YOU</div>
            </div>
            <div className="relative w-1/2 h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-cyan-500">
                <canvas ref={coachCanvasRef} className="w-full h-full"></canvas>
                <div className="absolute top-3 left-3 text-cyan-400 bg-black bg-opacity-70 px-4 py-2 rounded-lg font-bold text-sm tracking-wide">AI COACH</div>
            </div>

            <button onClick={handleStop} className="absolute top-5 left-5 bg-gray-900 bg-opacity-80 p-3 rounded-full hover:bg-opacity-100 z-20 transition-all border-2 border-gray-600 hover:border-gray-400">
                <ChevronLeftIcon className="w-7 h-7 text-white" />
            </button>

            <div className="absolute top-5 left-20 z-20">
                <button
                    onClick={() => setShowCameraControls(!showCameraControls)}
                    className="bg-gray-900 bg-opacity-80 px-4 py-2 rounded-lg hover:bg-opacity-100 transition-all border-2 border-cyan-500 text-cyan-400 font-semibold text-sm"
                >
                    Camera Angle
                </button>
                {showCameraControls && (
                    <div className="absolute top-full mt-2 bg-gray-900 bg-opacity-95 backdrop-blur-md rounded-lg border-2 border-cyan-500 overflow-hidden shadow-xl">
                        <div className="p-2 space-y-1">
                            {(['front', 'side', 'three-quarter', 'dynamic'] as CameraAngle[]).map((angle) => (
                                <button
                                    key={angle}
                                    onClick={() => {
                                        setCameraAngle(angle);
                                        setShowCameraControls(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left text-sm font-medium rounded transition-all ${
                                        cameraAngle === angle
                                            ? 'bg-cyan-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-800'
                                    }`}
                                >
                                    {angle === 'three-quarter' ? '3/4 View' : angle.charAt(0).toUpperCase() + angle.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute top-5 right-5 bg-gray-900 bg-opacity-90 backdrop-blur-md px-6 py-3 rounded-xl z-20 border-2 border-blue-500">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Reps</div>
                        <div className="text-4xl font-bold text-white">{repCount}</div>
                    </div>
                    <div className="w-px h-12 bg-gray-600"></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Set</div>
                        <div className="text-2xl font-bold text-white">{currentSet}</div>
                    </div>
                    <div className="w-px h-12 bg-gray-600"></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Phase</div>
                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${phaseColors[currentPhase]} text-white uppercase tracking-wide`}>
                            {currentPhase}
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-gray-900 to-transparent z-10">
                <div className="max-w-4xl mx-auto bg-gray-900 bg-opacity-95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border-2 border-gray-700">
                    {!isCoachActive ? (
                        <button onClick={handleStart} className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-5 px-6 rounded-xl text-xl transition-all shadow-xl">
                            Start Workout
                        </button>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-6 mb-4">
                                <div className="flex-grow">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Form Score</h3>
                                    <div className="w-full bg-gray-800 rounded-full h-6 border border-gray-700">
                                        <div
                                            className={`h-6 rounded-full transition-all duration-300 ${
                                                formMatch >= 80 ? 'bg-green-500' : formMatch >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${formMatch}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="text-5xl font-bold text-white w-28 text-center">{formMatch}%</div>
                            </div>
                            <p className={`text-center font-bold text-xl ${feedbackColor[feedback.type]}`}>{feedback.message}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExerciseTracker;
