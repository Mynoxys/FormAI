export const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const easeInOutQuad = (t: number): number => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

export const createRealisticSquatAnimation = (timestamp: number, duration: number = 4000): number => {
    const cycleTime = timestamp % duration;
    const halfDuration = duration / 2;

    if (cycleTime < halfDuration) {
        const t = cycleTime / halfDuration;
        return easeInOutCubic(t);
    } else {
        const t = (cycleTime - halfDuration) / halfDuration;
        return 1 - easeInOutCubic(t);
    }
};
