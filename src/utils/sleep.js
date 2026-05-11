// Shared utility to safely pause execution
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
