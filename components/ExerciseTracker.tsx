
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { interpolatePose, calculatePoseSimilarity } from '../utils/poseUtils';
import { PoseLandmarks, Feedback, ExerciseType, Landmark } from '../types';
import { generateSpeech } from '../services/geminiService';
import { ChevronLeftIcon } from './Icons';

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

// --- FOCUSED BODY SKELETON DEFINITIONS ---
const BODY_LANDMARK_INDICES = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BODY_CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], 
    [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
];

// --- EXERCISE DEFINITIONS FOR VIRTUAL COACH ---
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
            LEFT_SHOULDER: { x: 0.65, y: 0.3 }, RIGHT_SHOULDER: { x: 0.35, y: 0.3 },
            LEFT_HIP: { x: 0.6, y: 0.5 }, RIGHT_HIP: { x: 0.4, y: 0.5 },
            LEFT_KNEE: { x: 0.62, y: 0.7 }, RIGHT_KNEE: { x: 0.38, y: 0.7 },
            LEFT_ANKLE: { x: 0.65, y: 0.9 }, RIGHT_ANKLE: { x: 0.35, y: 0.9 },
            LEFT_ELBOW: { x: 0.75, y: 0.4 }, RIGHT_ELBOW: { x: 0.25, y: 0.4 },
            LEFT_WRIST: { x: 0.8, y: 0.5 }, RIGHT_WRIST: { x: 0.2, y: 0.5 },
            LEFT_EAR: { x: 0.7, y: 0.2 }, RIGHT_EAR: { x: 0.3, y: 0.2 }
        }),
        downPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.65, y: 0.45 }, RIGHT_SHOULDER: { x: 0.35, y: 0.45 },
            LEFT_HIP: { x: 0.6, y: 0.65 }, RIGHT_HIP: { x: 0.4, y: 0.65 },
            LEFT_KNEE: { x: 0.68, y: 0.8 }, RIGHT_KNEE: { x: 0.32, y: 0.8 },
            LEFT_ANKLE: { x: 0.7, y: 0.95 }, RIGHT_ANKLE: { x: 0.3, y: 0.95 },
            LEFT_ELBOW: { x: 0.75, y: 0.55 }, RIGHT_ELBOW: { x: 0.25, y: 0.55 },
            LEFT_WRIST: { x: 0.8, y: 0.65 }, RIGHT_WRIST: { x: 0.2, y: 0.65 },
            LEFT_EAR: { x: 0.7, y: 0.35 }, RIGHT_EAR: { x: 0.3, y: 0.35 }
        }),
        relevantLandmarks: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE']
    },
    pushup: {
        name: 'Push-ups',
        upPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.4, y: 0.5 }, RIGHT_SHOULDER: { x: 0.4, y: 0.5 },
            LEFT_HIP: { x: 0.6, y: 0.5 }, RIGHT_HIP: { x: 0.6, y: 0.5 },
            LEFT_KNEE: { x: 0.8, y: 0.5 }, RIGHT_KNEE: { x: 0.8, y: 0.5 },
            LEFT_ANKLE: { x: 0.95, y: 0.5 }, RIGHT_ANKLE: { x: 0.95, y: 0.5 },
            LEFT_ELBOW: { x: 0.4, y: 0.65 }, RIGHT_ELBOW: { x: 0.4, y: 0.65 },
            LEFT_WRIST: { x: 0.4, y: 0.8 }, RIGHT_WRIST: { x: 0.4, y: 0.8 },
            LEFT_EAR: { x: 0.35, y: 0.45 }, RIGHT_EAR: { x: 0.35, y: 0.45 },
        }),
        downPose: createNormalizedPose({
            LEFT_SHOULDER: { x: 0.4, y: 0.7 }, RIGHT_SHOULDER: { x: 0.4, y: 0.7 },
            LEFT_HIP: { x: 0.6, y: 0.7 }, RIGHT_HIP: { x: 0.6, y: 0.7 },
            LEFT_KNEE: { x: 0.8, y: 0.7 }, RIGHT_KNEE: { x: 0.8, y: 0.7 },
            LEFT_ANKLE: { x: 0.95, y: 0.7 }, RIGHT_ANKLE: { x: 0.95, y: 0.7 },
            LEFT_ELBOW: { x: 0.5, y: 0.75 }, RIGHT_ELBOW: { x: 0.5, y: 0.75 },
            LEFT_WRIST: { x: 0.4, y: 0.8 }, RIGHT_WRIST: { x: 0.4, y: 0.8 },
            LEFT_EAR: { x: 0.35, y: 0.65 }, RIGHT_EAR: { x: 0.35, y: 0.65 },
        }),
        relevantLandmarks: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST', 'LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE']
    }
};

const drawStickman = (ctx: CanvasRenderingContext2D, pose: Partial<PoseLandmarks>, color: string) => {
    const landmarkList = landmarkNames.map(name => pose[name as keyof PoseLandmarks]);

    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    window.drawConnectors(ctx, landmarkList, BODY_CONNECTIONS, { color, lineWidth: 8 });

    const leftShoulder = landmarkList[11];
    const rightShoulder = landmarkList[12];
    const leftEar = landmarkList[7];
    const rightEar = landmarkList[8];

    if (leftShoulder && rightShoulder) {
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const headRadius = shoulderWidth > 5 ? shoulderWidth * 0.4 : 10;
        const headCenterY = (leftEar && rightEar) ? (leftEar.y + rightEar.y) / 2 : shoulderCenterY - headRadius * 1.5;
        ctx.beginPath();
        ctx.arc(shoulderCenterX, headCenterY, headRadius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = color;
        // Fix: Explicitly provide the fill rule to the fill() method. Some browser
        // environments require this argument and will throw an error if it's missing.
        // This error can be misattributed to other lines (like closePath) due to sourcemaps.
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

    const poseRef = useRef<any>(null);
    const coachAnimationIdRef = useRef<number>();
    const lastPoseRef = useRef<PoseLandmarks | null>(null);
    const userProportionsRef = useRef<{ torsoHeight: number } | null>(null);
    const genericCoachPoseRef = useRef<Partial<PoseLandmarks>>({});
    const lastSpokenMsgRef = useRef('');
    const speakTimeoutRef = useRef<NodeJS.Timeout>();
    const onResultsLogicRef = useRef((_results: any) => {});

    const speakFeedback = useCallback(async (message: string) => {
        if (message && message !== lastSpokenMsgRef.current) {
            lastSpokenMsgRef.current = message;
            await generateSpeech(message);
            if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
            speakTimeoutRef.current = setTimeout(() => { lastSpokenMsgRef.current = ''; }, 2000);
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

            if (results.poseLandmarks) {
                const allLandmarks = results.poseLandmarks;
                const bodyLandmarks = BODY_LANDMARK_INDICES.map(i => allLandmarks[i]);
                window.drawConnectors(canvasCtx, allLandmarks, BODY_CONNECTIONS, { color: '#4F46E5', lineWidth: 4 });
                window.drawLandmarks(canvasCtx, bodyLandmarks, { color: '#EC4899', radius: 4 });
                
                const landmarks: PoseLandmarks = allLandmarks.reduce((acc: any, lm: any, i: number) => {
                    acc[landmarkNames[i]] = lm;
                    return acc;
                }, {} as PoseLandmarks);
                lastPoseRef.current = landmarks;

                if(isCoachActive && selectedExercise) {
                    const config = EXERCISE_CONFIG[selectedExercise];
                    const similarity = calculatePoseSimilarity(landmarks, genericCoachPoseRef.current, config.relevantLandmarks);
                    setFormMatch(similarity);

                    let newFeedback: Feedback;
                    if (similarity > 90) newFeedback = { message: 'Excellent Match!', type: 'success' };
                    else if (similarity > 70) newFeedback = { message: 'Good, keep following!', type: 'info' };
                    else newFeedback = { message: 'Focus on the coach', type: 'warning' };
                    
                    if (newFeedback.message !== feedback.message) {
                        setFeedback(newFeedback);
                        if (similarity < 70) {
                           speakFeedback('Match the coach.');
                        }
                    }
                }
            }
            canvasCtx.restore();
        };
    }, [isCoachActive, selectedExercise, speakFeedback, feedback.message]);

    const stableOnResults = useCallback((results: any) => {
        onResultsLogicRef.current(results);
    }, []);

    const animateCoach = useCallback((timestamp: number) => {
        if (!coachCanvasRef.current || !selectedExercise || !userProportionsRef.current) {
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
            return;
        }

        const coachCtx = coachCanvasRef.current.getContext('2d');
        const coachCanvas = coachCanvasRef.current;
        if (!coachCtx) return;

        const config = EXERCISE_CONFIG[selectedExercise];
        const animationDuration = 4000;
        const progress = (timestamp % animationDuration) / animationDuration;
        const t = (Math.sin(progress * 2 * Math.PI - Math.PI / 2) + 1) / 2;
        
        const genericAnimatedPose = interpolatePose(config.upPose, config.downPose, t);
        genericCoachPoseRef.current = genericAnimatedPose;
        
        const userTorsoHeight = userProportionsRef.current.torsoHeight;

        const gPose = genericAnimatedPose;
        if (!gPose.LEFT_SHOULDER || !gPose.RIGHT_SHOULDER || !gPose.LEFT_HIP || !gPose.RIGHT_HIP) {
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
            return;
        }

        const gShoulderY = (gPose.LEFT_SHOULDER.y + gPose.RIGHT_SHOULDER.y) / 2;
        const gHipY = (gPose.LEFT_HIP.y + gPose.RIGHT_HIP.y) / 2;
        const gTorsoHeight = Math.abs(gShoulderY - gHipY);
        
        const targetTorsoHeightPixels = userTorsoHeight * coachCanvas.height;
        const drawingScale = gTorsoHeight > 0 ? targetTorsoHeightPixels / gTorsoHeight : 0;

        const finalCoachPose: Partial<PoseLandmarks> = {};
        for (const key in genericAnimatedPose) {
            const lm = genericAnimatedPose[key as keyof PoseLandmarks]!;
            finalCoachPose[key as keyof PoseLandmarks] = {
                ...lm,
                x: (lm.x - 0.5) * drawingScale + (coachCanvas.width / 2),
                // Fix: The original vertical positioning (`* 0.8`) was flawed and pushed the
                // coach's body off-screen. This corrects the math to properly center the
                // coach's hips in the canvas, ensuring the full body is visible.
                y: (lm.y - gHipY) * drawingScale + (coachCanvas.height / 2)
            };
        }
        
        coachCtx.clearRect(0, 0, coachCanvas.width, coachCanvas.height);
        drawStickman(coachCtx, finalCoachPose, '#00FFFF');

        coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
    }, [selectedExercise]);

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
        setFeedback({ message: 'Get in position and start!', type: 'info' });
    };

    const handleRecalibrate = () => {
        if (lastPoseRef.current) {
            const userPose = lastPoseRef.current;
            const { LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP } = userPose;

            if (
                !LEFT_SHOULDER || !RIGHT_SHOULDER || !LEFT_HIP || !RIGHT_HIP ||
                (LEFT_SHOULDER.visibility ?? 0) < 0.7 ||
                (RIGHT_SHOULDER.visibility ?? 0) < 0.7 ||
                (LEFT_HIP.visibility ?? 0) < 0.7 ||
                (RIGHT_HIP.visibility ?? 0) < 0.7
            ) {
                setFeedback({ message: 'Cannot see your full body. Adjust your position.', type: 'warning' });
                return;
            }

            const shoulderMidY = (LEFT_SHOULDER.y + RIGHT_SHOULDER.y) / 2;
            const hipMidY = (LEFT_HIP.y + RIGHT_HIP.y) / 2;
            userProportionsRef.current = { torsoHeight: Math.abs(shoulderMidY - hipMidY) };
            
            setIsCoachActive(true);
            setFeedback({ message: 'Follow the coach!', type: 'info' });
            if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
            coachAnimationIdRef.current = requestAnimationFrame(animateCoach);
        } else {
            setFeedback({ message: 'Could not detect pose. Make sure you are visible.', type: 'warning' });
        }
    };
    
    const handleStop = () => {
        setIsCoachActive(false);
        setSelectedExercise(null);
        setFeedback({ message: 'Select an exercise!', type: 'info' });
        setFormMatch(0);
        if (coachAnimationIdRef.current) cancelAnimationFrame(coachAnimationIdRef.current);
    };

    if (!selectedExercise) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center p-4">
                <h2 className="text-3xl font-bold mb-8">Choose Your Exercise</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md">
                    {Object.entries(EXERCISE_CONFIG).map(([key, { name }]) => (
                        <button key={key} onClick={() => handleSelectExercise(key as ExerciseType)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 px-4 rounded-lg text-xl transition-transform transform hover:scale-105">
                            {name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const feedbackColor = { success: 'text-green-400', warning: 'text-yellow-400', info: 'text-blue-400' };

    return (
        <div className="flex-grow w-full h-full flex flex-row bg-black p-2 gap-2">
            <div className="relative w-1/2 h-full rounded-lg overflow-hidden">
                <video ref={videoRef} className="hidden" autoPlay playsInline></video>
                <canvas ref={canvasRef} className="w-full h-full" style={{ transform: 'scaleX(-1)' }}></canvas>
                <div className="absolute top-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">USER</div>
            </div>
            <div className="relative w-1/2 h-full bg-gray-800 rounded-lg overflow-hidden">
                <canvas ref={coachCanvasRef} className="w-full h-full"></canvas>
                <div className="absolute top-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded">COACH</div>
            </div>
            
            <button onClick={handleStop} className="absolute top-4 left-4 bg-gray-800 bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 z-20">
                <ChevronLeftIcon className="w-6 h-6 text-white" />
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent z-10">
                <div className="max-w-3xl mx-auto bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg p-4 shadow-2xl border border-gray-700">
                    {!isCoachActive ? (
                        <button onClick={handleRecalibrate} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg text-lg">
                            Start & Calibrate
                        </button>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-grow">
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Form Match</h3>
                                    <div className="w-full bg-gray-700 rounded-full h-4">
                                        <div className="bg-indigo-500 h-4 rounded-full transition-all duration-300" style={{ width: `${formMatch}%` }}></div>
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-white w-24 text-center">{formMatch}%</div>
                            </div>
                            <p className={`mt-3 text-center font-semibold text-lg ${feedbackColor[feedback.type]}`}>{feedback.message}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExerciseTracker;