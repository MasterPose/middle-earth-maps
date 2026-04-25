export const { max, min, round } = Math;

export const clampYaw = (angle: number) => ((angle + 180) % 360) - 180;
