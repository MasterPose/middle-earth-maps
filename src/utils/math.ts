export const {
    max,
    min,
    round,
    cos,
    sin,
    atan2,
    sqrt,
    asin,
    PI,
    random,
    pow,
    ceil,
    tan,
    abs,
    acos,
    atan
} = Math;

export const clampYaw = (angle: number) => ((angle + 180) % 360) - 180;
