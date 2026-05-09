import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getCredentials } from '../config/vault.js';

export async function analyzeFailureLog(logContent) {
    const { geminiKey } = getCredentials();
    if (!geminiKey) throw new Error("Gemini API Key missing from vault.");

    const genAI = new GoogleGenerativeAI(geminiKey);
    
    // Define the strict JSON schema we want Gemini to return
    const responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
            owaspCategory: { type: SchemaType.STRING, description: "The OWASP Top 10 category (e.g., A03:2021-Injection)" },
            explanation: { type: SchemaType.STRING, description: "A concise 2-sentence explanation of why the build failed." },
            remediation: { type: SchemaType.STRING, description: "The corrected code or terminal command to fix the issue." }
        },
        required: ["owaspCategory", "explanation", "remediation"],
    };

    // Gemini 2.5 flash model
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
    });

    const prompt = `
    You are an expert DevSecOps engineer. 
    Analyze the following CI/CD pipeline failure log. 
    Identify the security vulnerability, map it to an OWASP Top 10 category, and provide a fix.
    
    FAILURE LOG:
    ${logContent}
    `;

    try {
        const result = await model.generateContent(prompt);
        // The response is guaranteed to be a JSON string matching our schema
        return JSON.parse(result.response.text());
    } catch (error) {
        throw new Error(`AI Analysis Failed: ${error.message}`);
    }
}