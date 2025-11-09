import { BiomechanicalSquatPose } from './squatBiomechanics';

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface Point2D {
    x: number;
    y: number;
}

function project3DTo2D(point: Point3D, canvasWidth: number, canvasHeight: number, scale: number = 1): Point2D {
    const perspective = 500;
    const fov = perspective / (perspective + point.z * 100);

    const projectedX = point.x * canvasWidth * scale * fov;
    const projectedY = point.y * canvasHeight * scale * fov;

    return {
        x: projectedX,
        y: projectedY
    };
}

function centerPoseOnCanvas(
    pose: BiomechanicalSquatPose,
    canvasWidth: number,
    canvasHeight: number
): Record<string, Point2D> {
    const scale = 0.85;

    const allLandmarks: Point3D[] = Object.values(pose);

    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;

    allLandmarks.forEach(lm => {
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
    });

    const poseHeight = maxY - minY;
    const poseWidth = maxX - minX;
    const targetHeight = canvasHeight * scale;
    const scaleFactor = poseHeight > 0 ? targetHeight / poseHeight : 1;

    const poseCenterX = (minX + maxX) / 2;
    const poseCenterY = (minY + maxY) / 2;

    const projected: Record<string, Point2D> = {};

    for (const [key, landmark] of Object.entries(pose)) {
        const relativeX = (landmark.x - poseCenterX) * scaleFactor;
        const relativeY = (landmark.y - poseCenterY) * scaleFactor;

        const point3D = {
            x: relativeX,
            y: relativeY,
            z: landmark.z || 0
        };

        const point2D = project3DTo2D(point3D, 1, 1, 1);

        projected[key] = {
            x: point2D.x + canvasWidth / 2,
            y: point2D.y + canvasHeight / 2
        };
    }

    return projected;
}

export function drawCoachModel(
    ctx: CanvasRenderingContext2D,
    pose: BiomechanicalSquatPose,
    canvasWidth: number,
    canvasHeight: number,
    color: string = '#00D9FF'
): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const centered = centerPoseOnCanvas(pose, canvasWidth, canvasHeight);

    const connections: [string, string][] = [
        ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
        ['LEFT_SHOULDER', 'LEFT_ELBOW'],
        ['LEFT_ELBOW', 'LEFT_WRIST'],
        ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
        ['RIGHT_ELBOW', 'RIGHT_WRIST'],
        ['LEFT_SHOULDER', 'LEFT_HIP'],
        ['RIGHT_SHOULDER', 'RIGHT_HIP'],
        ['LEFT_HIP', 'RIGHT_HIP'],
        ['LEFT_HIP', 'LEFT_KNEE'],
        ['LEFT_KNEE', 'LEFT_ANKLE'],
        ['RIGHT_HIP', 'RIGHT_KNEE'],
        ['RIGHT_KNEE', 'RIGHT_ANKLE'],
        ['LEFT_ANKLE', 'LEFT_HEEL'],
        ['RIGHT_ANKLE', 'RIGHT_HEEL'],
        ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
        ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX']
    ];

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([start, end]) => {
        const startPoint = centered[start];
        const endPoint = centered[end];

        if (startPoint && endPoint) {
            const gradient = ctx.createLinearGradient(
                startPoint.x, startPoint.y,
                endPoint.x, endPoint.y
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, color);
            gradient.addColorStop(1, color);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();
        }
    });

    const keyJoints = [
        'LEFT_SHOULDER', 'RIGHT_SHOULDER',
        'LEFT_HIP', 'RIGHT_HIP',
        'LEFT_KNEE', 'RIGHT_KNEE',
        'LEFT_ANKLE', 'RIGHT_ANKLE'
    ];

    keyJoints.forEach(jointName => {
        const joint = centered[jointName];
        if (joint) {
            const gradient = ctx.createRadialGradient(
                joint.x, joint.y, 0,
                joint.x, joint.y, 8
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.6, color);
            gradient.addColorStop(1, 'rgba(0, 217, 255, 0.3)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(joint.x, joint.y, 8, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    const leftShoulder = centered['LEFT_SHOULDER'];
    const rightShoulder = centered['RIGHT_SHOULDER'];
    const leftEar = centered['LEFT_EAR'];
    const rightEar = centered['RIGHT_EAR'];

    if (leftShoulder && rightShoulder && leftEar && rightEar) {
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const headCenterX = (leftEar.x + rightEar.x) / 2;
        const headCenterY = (leftEar.y + rightEar.y) / 2;

        const shoulderWidth = Math.hypot(
            leftShoulder.x - rightShoulder.x,
            leftShoulder.y - rightShoulder.y
        );
        const headRadius = shoulderWidth * 0.45;

        const neckGradient = ctx.createLinearGradient(
            shoulderCenterX, shoulderCenterY,
            headCenterX, headCenterY
        );
        neckGradient.addColorStop(0, color);
        neckGradient.addColorStop(1, color);

        ctx.strokeStyle = neckGradient;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderCenterX, shoulderCenterY);
        ctx.lineTo(headCenterX, headCenterY);
        ctx.stroke();

        const headGradient = ctx.createRadialGradient(
            headCenterX, headCenterY, 0,
            headCenterX, headCenterY, headRadius
        );
        headGradient.addColorStop(0, color);
        headGradient.addColorStop(0.7, color);
        headGradient.addColorStop(1, 'rgba(0, 217, 255, 0.4)');

        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY, headRadius, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}

export function drawPhaseIndicator(
    ctx: CanvasRenderingContext2D,
    phaseName: string,
    progress: number,
    canvasWidth: number,
    canvasHeight: number
): void {
    const indicatorY = canvasHeight - 60;
    const indicatorWidth = canvasWidth * 0.6;
    const indicatorHeight = 8;
    const indicatorX = (canvasWidth - indicatorWidth) / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);

    const gradient = ctx.createLinearGradient(indicatorX, 0, indicatorX + indicatorWidth * progress, 0);
    gradient.addColorStop(0, '#00D9FF');
    gradient.addColorStop(1, '#00FFB3');

    ctx.fillStyle = gradient;
    ctx.fillRect(indicatorX, indicatorY, indicatorWidth * progress, indicatorHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phaseName, canvasWidth / 2, indicatorY - 10);
}
