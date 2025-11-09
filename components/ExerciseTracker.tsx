import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PoseLandmarks, Feedback, ExerciseType } from '../types';
import { ChevronLeftIcon, VolumeIcon } from './Icons';
import { SquatDetector, SquatPhase } from '../utils/squatAnalysis';
import {
  voiceFeedbackQueue,
  generateFormFeedback,
  generateRepFeedback,
  generateSetCompleteFeedback
} from '../services/voiceFeedbackService';
import { workoutService } from '../services/supabaseClient';
import { initializeAudioContext } from '../services/geminiService';

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

const EXERCISE_CONFIG: Record<ExerciseType, { name: string }> = {
  squat: { name: 'Squats' },
  pushup: { name: 'Push-ups' },
};

const drawPositioningGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();

  const margin = 40;
  const guideX = margin;
  const guideY = margin;
  const guideWidth = width - (margin * 2);
  const guideHeight = height - (margin * 2);

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);
  ctx.setLineDash([]);

  const cornerLength = 30;
  ctx.strokeStyle = '#10B981';
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

  ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Position your full body within the frame', width / 2, 30);

  ctx.restore();
};

const ExerciseTracker: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [feedback, setFeedback] = useState<Feedback>({ message: 'Select an exercise to begin!', type: 'info' });
  const [formMatch, setFormMatch] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);
  const [isCoachActive, setIsCoachActive] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<SquatPhase>('standing');
  const [currentSet, setCurrentSet] = useState(1);
  const [targetReps] = useState(10);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  const poseRef = useRef<any>(null);
  const lastPoseRef = useRef<PoseLandmarks | null>(null);
  const squatDetectorRef = useRef(new SquatDetector());
  const repDurationsRef = useRef<number[]>([]);
  const formScoresRef = useRef<number[]>([]);
  const userId = useRef(`user_${Date.now()}`);

  const onResultsLogicRef = useRef((_results: any) => {});

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
        window.drawLandmarks(canvasCtx, bodyLandmarks, { color: '#3B82F6', radius: 6 });

        const landmarks: PoseLandmarks = allLandmarks.reduce((acc: any, lm: any, i: number) => {
          acc[landmarkNames[i]] = lm;
          return acc;
        }, {} as PoseLandmarks);
        lastPoseRef.current = landmarks;

        if (isCoachActive && selectedExercise === 'squat') {
          const detector = squatDetectorRef.current;
          const { phase, repCompleted, repDuration } = detector.detectPhase(landmarks);

          setCurrentPhase(phase);

          const formAnalysis = detector.analyzeForm(landmarks);
          setFormMatch(formAnalysis.overallScore);
          formScoresRef.current.push(formAnalysis.overallScore);

          if (formScoresRef.current.length > 100) {
            formScoresRef.current = formScoresRef.current.slice(-100);
          }

          setDebugInfo({
            kneeAngle: formAnalysis.kneeAngle.toFixed(1),
            hipAngle: formAnalysis.hipAngle.toFixed(1),
            torsoAngle: formAnalysis.torsoAngle.toFixed(1),
            depth: formAnalysis.depth.toFixed(1),
            visibility: {
              leftHip: ((landmarks.LEFT_HIP?.visibility ?? 0) * 100).toFixed(0),
              rightHip: ((landmarks.RIGHT_HIP?.visibility ?? 0) * 100).toFixed(0),
              leftKnee: ((landmarks.LEFT_KNEE?.visibility ?? 0) * 100).toFixed(0),
              rightKnee: ((landmarks.RIGHT_KNEE?.visibility ?? 0) * 100).toFixed(0),
            }
          });

          const formFeedback = generateFormFeedback(
            !formAnalysis.kneeAlignment,
            formAnalysis.kneesOverToes,
            formAnalysis.torsoAngle,
            formAnalysis.depth,
            phase
          );

          if (formFeedback) {
            voiceFeedbackQueue.addFeedback(formFeedback);
            setFeedback({
              message: formFeedback.message,
              type: formFeedback.priority === 'critical' ? 'warning' : 'info'
            });
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 2000);
          } else {
            if (phase !== 'standing' && formAnalysis.overallScore >= 85) {
              setFeedback({ message: 'Excellent form!', type: 'success' });
            } else if (phase !== 'standing' && formAnalysis.overallScore >= 70) {
              setFeedback({ message: 'Good form', type: 'success' });
            } else if (phase === 'standing') {
              setFeedback({ message: 'Ready for next rep', type: 'info' });
            } else {
              setFeedback({ message: 'Keep improving', type: 'info' });
            }
          }

          if (repCompleted) {
            const newRepCount = detector.getRepCount();
            setRepCount(newRepCount);
            repDurationsRef.current.push(repDuration);

            const repFeedback = generateRepFeedback(newRepCount, formAnalysis.overallScore);
            voiceFeedbackQueue.addFeedback(repFeedback);
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 1500);

            if (sessionId) {
              workoutService.addRep({
                session_id: sessionId,
                rep_number: newRepCount,
                set_number: currentSet,
                duration_ms: repDuration,
                form_score: formAnalysis.overallScore,
                phase_data: { phase, formAnalysis },
                feedback_given: formAnalysis.feedback,
              });
            }

            if (newRepCount >= targetReps) {
              const avgScore = formScoresRef.current.reduce((a, b) => a + b, 0) / formScoresRef.current.length;
              const setFeedback = generateSetCompleteFeedback(currentSet, avgScore);
              voiceFeedbackQueue.addFeedback(setFeedback);
              setIsSpeaking(true);
              setTimeout(() => setIsSpeaking(false), 3000);
            }
          }
        }
      }
      canvasCtx.restore();
    };
  }, [isCoachActive, selectedExercise, currentSet, targetReps, sessionId]);

  const stableOnResults = useCallback((results: any) => {
    onResultsLogicRef.current(results);
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;

    const canvas = canvasRef.current;
    if (canvas && canvas.parentElement) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }

    const pose = new window.Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
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
        width: 1280,
        height: 720
      });
      camera.start();
    }

    return () => {
      camera?.stop();
      const poseToClose = poseRef.current;
      poseRef.current = null;
      poseToClose?.close();
    };
  }, [selectedExercise, stableOnResults]);

  const handleSelectExercise = (exercise: ExerciseType) => {
    setSelectedExercise(exercise);
    setFeedback({ message: 'Position yourself and press Start Workout!', type: 'info' });
    setRepCount(0);
    setCurrentPhase('standing');
    squatDetectorRef.current.reset();
    formScoresRef.current = [];
    repDurationsRef.current = [];
  };

  const handleStart = async () => {
    try {
      await initializeAudioContext();
      console.log('Audio context initialized');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }

    if (lastPoseRef.current) {
      const userPose = lastPoseRef.current;
      const { LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE } = userPose;

      if (
        !LEFT_SHOULDER || !RIGHT_SHOULDER || !LEFT_HIP || !RIGHT_HIP || !LEFT_KNEE || !RIGHT_KNEE ||
        (LEFT_SHOULDER.visibility ?? 0) < 0.7 ||
        (RIGHT_SHOULDER.visibility ?? 0) < 0.7 ||
        (LEFT_HIP.visibility ?? 0) < 0.7 ||
        (RIGHT_HIP.visibility ?? 0) < 0.7 ||
        (LEFT_KNEE.visibility ?? 0) < 0.7 ||
        (RIGHT_KNEE.visibility ?? 0) < 0.7
      ) {
        setFeedback({ message: 'Step back - I need to see your full body!', type: 'warning' });
        voiceFeedbackQueue.addFeedback({
          message: 'Step back so I can see your full body',
          priority: 'critical',
          timestamp: Date.now(),
          category: 'instruction',
        });
        return;
      }

      const newSessionId = await workoutService.startSession(
        userId.current,
        selectedExercise || 'squat'
      );
      setSessionId(newSessionId);

      setIsCoachActive(true);
      squatDetectorRef.current.reset();
      setRepCount(0);
      setFeedback({ message: 'Workout started! I\'m watching your form', type: 'success' });

      voiceFeedbackQueue.addFeedback({
        message: 'Let\'s begin! I\'ll guide you through each rep',
        priority: 'important',
        timestamp: Date.now(),
        category: 'instruction',
      });
    } else {
      setFeedback({ message: 'Cannot detect you. Check camera!', type: 'warning' });
    }
  };

  const handleStop = async () => {
    setIsCoachActive(false);

    if (sessionId && formScoresRef.current.length > 0) {
      const avgScore = formScoresRef.current.reduce((a, b) => a + b, 0) / formScoresRef.current.length;
      const bestScore = Math.max(...formScoresRef.current);

      await workoutService.endSession(sessionId, repCount, currentSet, avgScore);
      await workoutService.updateUserStats(userId.current, selectedExercise || 'squat', {
        totalReps: repCount,
        bestFormScore: bestScore,
        avgFormScore: avgScore,
      });

      voiceFeedbackQueue.addFeedback({
        message: `Workout complete! You did ${repCount} reps with an average form score of ${Math.round(avgScore)} percent. Great job!`,
        priority: 'important',
        timestamp: Date.now(),
        category: 'motivation',
      });
    }

    setSelectedExercise(null);
    setFeedback({ message: 'Select an exercise to begin!', type: 'info' });
    setFormMatch(0);
    setRepCount(0);
    setSessionId(null);
    formScoresRef.current = [];
    repDurationsRef.current = [];
    voiceFeedbackQueue.clear();
  };

  if (!selectedExercise) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4 text-white">Choose Your Exercise</h2>
          <p className="text-gray-400 text-lg">Your AI voice coach will guide you through every rep</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
          {Object.entries(EXERCISE_CONFIG).map(([key, { name }]) => (
            <button
              key={key}
              onClick={() => handleSelectExercise(key as ExerciseType)}
              className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-12 px-6 rounded-2xl text-3xl transition-all transform hover:scale-105 shadow-2xl border-2 border-green-400"
            >
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

  const feedbackColor = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
  };

  return (
    <div className="flex-grow w-full h-full flex flex-col bg-black p-3 gap-3">
      <div className="relative flex-grow rounded-xl overflow-hidden shadow-2xl border-2 border-green-600">
        <video ref={videoRef} className="hidden" autoPlay playsInline></video>
        <canvas ref={canvasRef} className="w-full h-full" style={{ transform: 'scaleX(-1)' }}></canvas>

        <div className="absolute top-4 left-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleStop}
              className="bg-gray-900 bg-opacity-80 p-3 rounded-full hover:bg-opacity-100 transition-all border-2 border-gray-600 hover:border-gray-400"
            >
              <ChevronLeftIcon className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={() => setShowDebug(!showDebug)}
              className="bg-gray-900 bg-opacity-80 px-4 py-2 rounded-full hover:bg-opacity-100 transition-all border-2 border-gray-600 hover:border-gray-400 text-white text-sm font-semibold"
            >
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </button>

            {isSpeaking && (
              <div className="flex items-center gap-2 bg-green-600 bg-opacity-90 px-4 py-2 rounded-full">
                <VolumeIcon className="w-5 h-5 text-white animate-pulse" />
                <span className="text-white font-semibold text-sm">AI Coach Speaking</span>
              </div>
            )}
          </div>

          {showDebug && debugInfo && (
            <div className="bg-gray-900 bg-opacity-90 backdrop-blur-md px-4 py-3 rounded-xl border-2 border-blue-500 text-white text-xs">
              <div className="font-bold mb-2 text-blue-400">Debug Info:</div>
              <div>Knee Angle: {debugInfo.kneeAngle}°</div>
              <div>Hip Angle: {debugInfo.hipAngle}°</div>
              <div>Torso Angle: {debugInfo.torsoAngle}°</div>
              <div>Depth: {debugInfo.depth}%</div>
              <div className="mt-2 font-bold text-blue-400">Visibility:</div>
              <div>L Hip: {debugInfo.visibility.leftHip}% | R Hip: {debugInfo.visibility.rightHip}%</div>
              <div>L Knee: {debugInfo.visibility.leftKnee}% | R Knee: {debugInfo.visibility.rightKnee}%</div>
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 backdrop-blur-md px-6 py-4 rounded-xl border-2 border-green-500">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Reps</div>
              <div className="text-5xl font-bold text-white">{repCount}</div>
            </div>
            <div className="w-px h-14 bg-gray-600"></div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Set</div>
              <div className="text-3xl font-bold text-white">{currentSet}</div>
            </div>
            <div className="w-px h-14 bg-gray-600"></div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Phase</div>
              <div className={`text-sm font-bold px-3 py-1 rounded-full ${phaseColors[currentPhase]} text-white uppercase tracking-wide`}>
                {currentPhase}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 bg-opacity-95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border-2 border-gray-700">
        {!isCoachActive ? (
          <button
            onClick={handleStart}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-6 px-6 rounded-xl text-2xl transition-all shadow-xl"
          >
            Start Workout
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-6 mb-4">
              <div className="flex-grow">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Form Quality</h3>
                <div className="w-full bg-gray-800 rounded-full h-8 border border-gray-700">
                  <div
                    className={`h-8 rounded-full transition-all duration-300 flex items-center justify-end pr-3 ${
                      formMatch >= 85 ? 'bg-green-500' : formMatch >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${formMatch}%` }}
                  >
                    <span className="text-white font-bold text-sm">{formMatch}%</span>
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-center font-bold text-2xl ${feedbackColor[feedback.type]} mt-4`}>
              {feedback.message}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ExerciseTracker;
