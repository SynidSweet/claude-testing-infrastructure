// Main JavaScript entry point for mixed project
import { calculateSum } from './utils/math.js';
import { fetchData } from './services/api.js';

export function main() {
    const result = calculateSum(5, 3);
    console.log(`Sum: ${result}`);
    return result;
}

export async function mainAsync() {
    try {
        const data = await fetchData('https://api.example.com');
        return data;
    } catch (error) {
        console.error('Failed to fetch data:', error.message);
        return null;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}