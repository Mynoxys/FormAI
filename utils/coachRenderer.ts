import { BiomechanicalSquatPose } from './squatBiomechanics';
import { CameraConfig, rotatePoint3D, projectWithPerspective, Point3D, Point2D } from './cameraSystem';

function centerPoseOnCanvas(
    pose: BiomechanicalSquatPose,
    canvasWidth: number,
    canvasHeight: number,
    camera: CameraConfig
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

        const point3D: Point3D = {
            x: relativeX,
            y: relativeY,
            z: landmark.z || 0
        };

        const rotated = rotatePoint3D(point3D, camera.rotationY, camera.rotationX);
        const point2D = projectWithPerspective(rotated, camera, canvasWidth, canvasHeight);

        projected[key] = point2D;
    }

    return projected;
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

    drawGroundPlane(ctx, canvasWidth, canvasHeight, camera);

    const centered = centerPoseOnCanvas(pose, canvasWidth, canvasHeight, camera);

    drawShadow(ctx, centered, canvasWidth, canvasHeight);

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

function drawGroundPlane(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    camera: CameraConfig
): void {
    const groundY = canvasHeight * 0.85;

    ctx.save();
    ctx.globalAlpha = 0.15;

    const gradient = ctx.createLinearGradient(0, groundY - 100, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 217, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.05)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY - 50, canvasWidth, canvasHeight - groundY + 50);

    ctx.strokeStyle = 'rgba(0, 217, 255, 0.3)';
    ctx.lineWidth = 2;

    const perspectiveFactor = Math.abs(camera.rotationY) / 90;
    const gridSpacing = 60;
    const numLines = 8;

    for (let i = -numLines; i <= numLines; i++) {
        const offset = i * gridSpacing;
        const perspectiveOffset = offset * (0.5 + perspectiveFactor * 0.5);

        ctx.globalAlpha = 0.1 + (1 - Math.abs(i) / numLines) * 0.1;

        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2 + perspectiveOffset, groundY);
        ctx.lineTo(canvasWidth / 2 + offset, canvasHeight);
        ctx.stroke();

        if (i % 2 === 0) {
            const y = groundY + (Math.abs(i) * 15);
            if (y < canvasHeight) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasWidth, y);
                ctx.stroke();
            }
        }
    }

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
    const leftHip = centered['LEFT_HIP'];
    const rightHip = centered['RIGHT_HIP'];

    if (!leftAnkle || !rightAnkle || !leftHip || !rightHip) return;

    const shadowY = canvasHeight * 0.85;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const ankleY = (leftAnkle.y + rightAnkle.y) / 2;

    const heightFromGround = shadowY - ankleY;
    const shadowScale = Math.max(0.3, 1 - (heightFromGround / canvasHeight) * 0.5);

    ctx.save();
    ctx.globalAlpha = 0.25 * shadowScale;

    const centerX = (leftAnkle.x + rightAnkle.x) / 2;
    const width = Math.abs(rightAnkle.x - leftAnkle.x) * 1.5;
    const height = width * 0.4;

    const gradient = ctx.createRadialGradient(
        centerX, shadowY, 0,
        centerX, shadowY, width
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
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
