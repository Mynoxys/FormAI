import { BiomechanicalSquatPose } from './squatBiomechanics';
import { CameraConfig, rotatePoint3D, Point3D, Point2D } from './cameraSystem';

function projectOrthographic(
    point: Point3D,
    camera: CameraConfig
): Point2D {
    const rotated = rotatePoint3D(point, camera.rotationY, camera.rotationX);

    return {
        x: rotated.x,
        y: rotated.y
    };
}

function centerPoseOnCanvas(
    pose: BiomechanicalSquatPose,
    canvasWidth: number,
    canvasHeight: number,
    camera: CameraConfig
): Record<string, Point2D> {
    const allLandmarks: Point3D[] = Object.values(pose);

    const poseCenterX = allLandmarks.reduce((sum, lm) => sum + lm.x, 0) / allLandmarks.length;
    const poseCenterY = allLandmarks.reduce((sum, lm) => sum + lm.y, 0) / allLandmarks.length;

    const tempProjected: Record<string, Point2D> = {};

    for (const [key, landmark] of Object.entries(pose)) {
        const relativeX = landmark.x - poseCenterX;
        const relativeY = landmark.y - poseCenterY;

        const point3D: Point3D = {
            x: relativeX,
            y: relativeY,
            z: landmark.z || 0
        };

        const point2D = projectOrthographic(point3D, camera);
        tempProjected[key] = point2D;
    }

    const projectedPoints = Object.values(tempProjected);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    projectedPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const projectedWidth = maxX - minX;
    const projectedHeight = maxY - minY;

    const margin = 60;
    const targetWidth = canvasWidth - (margin * 2);
    const targetHeight = canvasHeight - (margin * 2);

    const scaleX = projectedWidth > 0 ? targetWidth / projectedWidth : 1;
    const scaleY = projectedHeight > 0 ? targetHeight / projectedHeight : 1;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const projectedCenterX = (minX + maxX) / 2;
    const projectedCenterY = (minY + maxY) / 2;

    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    const final: Record<string, Point2D> = {};
    for (const [key, point] of Object.entries(tempProjected)) {
        const scaledX = (point.x - projectedCenterX) * scale;
        const scaledY = (point.y - projectedCenterY) * scale;

        final[key] = {
            x: scaledX + canvasCenterX,
            y: scaledY + canvasCenterY
        };
    }

    return final;
}

export function drawCoachModel(
    ctx: CanvasRenderingContext2D,
    pose: BiomechanicalSquatPose,
    canvasWidth: number,
    canvasHeight: number,
    color: string = '#00D9FF',
    camera: CameraConfig
): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (canvasWidth === 0 || canvasHeight === 0) {
        return;
    }

    drawGroundPlane(ctx, canvasWidth, canvasHeight, camera);

    const centered = centerPoseOnCanvas(pose, canvasWidth, canvasHeight, camera);

    drawShadow(ctx, centered, canvasWidth, canvasHeight);

    ctx.save();

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
    ctx.restore();
}

function drawGroundPlane(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    camera: CameraConfig
): void {
    const groundY = canvasHeight * 0.90;

    ctx.save();
    ctx.globalAlpha = 0.1;

    const gradient = ctx.createLinearGradient(0, groundY - 50, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 217, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.05)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY - 30, canvasWidth, canvasHeight - groundY + 30);

    ctx.restore();
}

function drawShadow(
    ctx: CanvasRenderingContext2D,
    centered: Record<string, Point2D>,
    canvasWidth: number,
    canvasHeight: number
): void {
    const leftAnkle = centered['LEFT_ANKLE'];
    const rightAnkle = centered['RIGHT_ANKLE'];

    if (!leftAnkle || !rightAnkle) return;

    const shadowY = canvasHeight * 0.90;
    const ankleY = (leftAnkle.y + rightAnkle.y) / 2;

    const heightFromGround = shadowY - ankleY;
    const shadowScale = Math.max(0.2, Math.min(1, 1 - (heightFromGround / canvasHeight) * 0.3));

    ctx.save();
    ctx.globalAlpha = 0.2 * shadowScale;

    const centerX = (leftAnkle.x + rightAnkle.x) / 2;
    const width = Math.abs(rightAnkle.x - leftAnkle.x) * 1.8;
    const height = width * 0.35;

    const gradient = ctx.createRadialGradient(
        centerX, shadowY, 0,
        centerX, shadowY, width
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX, shadowY, width / 2, height / 2, 0, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
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
