// JavaScript math utilities
export function calculateSum(a, b) {
    return a + b;
}

export function calculateMultiply(a, b) {
    return a * b;
}

export function calculateDivide(a, b) {
    if (b === 0) {
        throw new Error('Division by zero');
    }
    return a / b;
}