export type CameraAngle = 'front' | 'side' | 'three-quarter' | 'dynamic';

export interface CameraConfig {
    angle: CameraAngle;
    rotationY: number;
    rotationX: number;
    distance: number;
    fov: number;
    tilt: number;
}

export const CAMERA_PRESETS: Record<CameraAngle, CameraConfig> = {
    'front': {
        angle: 'front',
        rotationY: 0,
        rotationX: 0,
        distance: 2.5,
        fov: 600,
        tilt: 0
    },
    'side': {
        angle: 'side',
        rotationY: 90,
        rotationX: 0,
        distance: 3.0,
        fov: 500,
        tilt: -5
    },
    'three-quarter': {
        angle: 'three-quarter',
        rotationY: 45,
        rotationX: 10,
        distance: 2.8,
        fov: 550,
        tilt: -8
    },
    'dynamic': {
        angle: 'dynamic',
        rotationY: 35,
        rotationX: 8,
        distance: 2.7,
        fov: 530,
        tilt: -10
    }
};

export function getCameraForSquatPhase(progress: number, selectedAngle: CameraAngle): CameraConfig {
    if (selectedAngle !== 'dynamic') {
        return CAMERA_PRESETS[selectedAngle];
    }

    if (progress < 0.25) {
        return {
            angle: 'dynamic',
            rotationY: 35,
            rotationX: 5,
            distance: 2.6,
            fov: 540,
            tilt: -5
        };
    } else if (progress < 0.55) {
        return {
            angle: 'dynamic',
            rotationY: 60,
            rotationX: 12,
            distance: 2.9,
            fov: 510,
            tilt: -12
        };
    } else if (progress < 0.85) {
        return {
            angle: 'dynamic',
            rotationY: 55,
            rotationX: 8,
            distance: 2.7,
            fov: 525,
            tilt: -10
        };
    } else {
        return {
            angle: 'dynamic',
            rotationY: 40,
            rotationX: 5,
            distance: 2.6,
            fov: 535,
            tilt: -6
        };
    }
}

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface Point2D {
    x: number;
    y: number;
}

function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

export function rotatePoint3D(point: Point3D, rotationY: number, rotationX: number): Point3D {
    const radY = degreesToRadians(rotationY);
    const radX = degreesToRadians(rotationX);

    let { x, y, z } = point;

    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);
    const xRotY = x * cosY - z * sinY;
    const zRotY = x * sinY + z * cosY;
    x = xRotY;
    z = zRotY;

    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const yRotX = y * cosX - z * sinX;
    const zRotX = y * sinX + z * cosX;
    y = yRotX;
    z = zRotX;

    return { x, y, z };
}

export function projectWithPerspective(
    point: Point3D,
    camera: CameraConfig,
    canvasWidth: number,
    canvasHeight: number
): Point2D {
    const perspective = camera.fov;
    const distanceFactor = camera.distance;

    const adjustedZ = (point.z * distanceFactor) + distanceFactor;
    const fov = perspective / (perspective + adjustedZ * 100);

    const scale = 0.9;
    const projectedX = point.x * canvasWidth * scale * fov;
    const projectedY = point.y * canvasHeight * scale * fov;

    const tiltOffset = (point.y * degreesToRadians(camera.tilt) * canvasHeight * 0.1);

    return {
        x: projectedX + canvasWidth / 2,
        y: projectedY + canvasHeight / 2 + tiltOffset
    };
}
