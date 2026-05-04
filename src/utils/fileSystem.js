import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

/**
 * Saves the AI DevSecOps report to a local markdown file.
 * Creates an 'audit-reports' directory if it doesn't exist.
 */
export async function saveReportToDisk(repoName, aiResult) {
    try {
        const reportsDir = path.join(process.cwd(), 'audit-reports');
        
        // Check if directory exists, create if not
        try {
            await fs.access(reportsDir);
        } catch {
            await fs.mkdir(reportsDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${repoName}-audit-${timestamp}.md`;
        const filePath = path.join(reportsDir, fileName);

        // Format the markdown content
        const markdownContent = `
# AI DevSecOps Audit Report
**Date:** ${new Date().toLocaleString()}
**Repository:** ${repoName}

## Vulnerability Details
* **OWASP Category:** ${aiResult.owaspCategory}

### Explanation
${aiResult.explanation}

### Remediation Plan
\`\`\`
${aiResult.remediation}
\`\`\`
        `.trim();

        await fs.writeFile(filePath, markdownContent, 'utf-8');
        return filePath;
    } catch (error) {
        logger.error(`Failed to write report to disk: ${error.message}`);
        return null;
    }
}