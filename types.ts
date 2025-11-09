
export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}
  
export interface PoseLandmarks {
    [key: string]: Landmark;
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
    LEFT_PINKY: Landmark;
    RIGHT_PINKY: Landmark;
    LEFT_INDEX: Landmark;
    RIGHT_INDEX: Landmark;
    LEFT_THUMB: Landmark;
    // Fix: Corrected a typo that broke the landmark definitions for RIGHT_THUMB and LEFT_HIP.
    RIGHT_THUMB: Landmark;
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

export type ExerciseType = 'squat' | 'pushup';

export interface Feedback {
    message: string;
    type: 'success' | 'warning' | 'info';
}