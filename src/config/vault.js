import Conf from 'conf';
import crypto from 'crypto';
import os from 'os';

const config = new Conf({ projectName: 'ai-devsecops-auditor' });

// SECURITY: Machine-Bound Key Generation

// We derive a unique 32-byte AES key using the local machine's identity.
// If the config file is stolen and moved to another PC, decryption will fail.

const algorithm = 'aes-256-gcm';

// Generate a unique random salt per installation instead of using a hardcoded one.
// This salt is stored in the config and is unique per machine setup.
function getInstallationSalt() {
    let salt = config.get('_installationSalt');
    if (!salt) {
        salt = crypto.randomBytes(32).toString('hex');
        config.set('_installationSalt', salt);
    }
    return salt;
}

const machineId = os.userInfo().username + '-' + os.hostname() + '-' + os.arch() + '-' + os.platform();
const ENCRYPTION_KEY = crypto.scryptSync(machineId, getInstallationSalt(), 32);

// Helper: Encrypt a string using AES-256-GCM

function encrypt(text) {
    if (!text) return null;

    // Generate a random 16-byte Initialization Vector for every encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the auth tag (verifies the data wasn't tampered with)
    const authTag = cipher.getAuthTag().toString('hex');

    // Store as a combined string: IV : AuthTag : Ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Helper: Decrypt a string back to plaintext

function decrypt(text) {
    if (!text) return null;

    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];

        const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        // If decryption fails (e.g., file moved to new PC, or tampered with), fail safely
        return null;
    }
}

// EXPORTS

export function saveCredentials(githubPat, geminiKey) {
    if (githubPat) config.set('githubPat', encrypt(githubPat));
    if (geminiKey) config.set('geminiKey', encrypt(geminiKey));
}

export function getCredentials() {
    return {
        githubPat: decrypt(config.get('githubPat')),
        geminiKey: decrypt(config.get('geminiKey'))
    };
}

// Clear all stored credentials from the vault
export function clearCredentials() {
    config.delete('githubPat');
    config.delete('geminiKey');
    config.delete('_installationSalt');
}