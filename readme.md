# AIAuditor

**A terminal-native, AI-powered DevSecOps engine.**

The AIAuditor bridges the gap between local development, remote CI/CD pipelines, and generative AI. It eliminates context-switching by allowing developers to push code, monitor GitHub Actions live, and receive automated, AI-driven security remediation directly inside their terminal.

----------

## Core Features

-   **Local Credential Vault:** Securely stores your GitHub PAT and Gemini API keys locally using AES-256-GCM encryption with machine-bound key derivation, bypassing clunky system git prompts.
    
-   **Unified Push & Live Polling:** Automatically pushes your branch and launches a live TUI dashboard to poll your GitHub Actions pipeline status.
    
-   **AI-Powered Remediation:** If the build fails a security scan, the auditor fetches the exact workflow logs and pipes them through **Gemini 2.5 Flash** to extract the OWASP vulnerability, explain it, and provide the exact code to fix it.
    
-   **Post-Deployment DAST:** Natively spins up an OWASP ZAP Docker container to run baseline Dynamic Application Security Testing against staging URLs.

-   **Local Preflight Security Scanning:** Scans for exposed secrets, lints Dockerfiles, and runs `npm audit` or Python dependency checks before pushing.

----------

## Prerequisites

Before installing, ensure you have the following installed on your system:

-   **Node.js** (v18 or higher recommended)
    
-   **Git**
    
-   **Docker** (Required for the OWASP ZAP DAST scanner)
    

----------

## Installation & Setup

### 1. Clone the Repository

Fork this repository to your own GitHub account, then clone it to your local machine:

```bash
git clone https://github.com/KaranSJ22/ai-auditor.git
cd ai-auditor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Link the CLI Globally

This allows you to run the `auditor` command from any directory on your system:

```bash
npm link
```

----------

## Configuration

Before using the tool, you must initialize your local credential vault. Run the following command anywhere in your terminal:

```bash
auditor init
```

**You will be prompted for:**

1.  **GitHub Personal Access Token (PAT):** Must have `repo` and `workflow` scopes to push code and read GitHub Actions logs. Must start with `ghp_` or `github_pat_`.
    
2.  **Gemini API Key:** [Get a free API key from Google AI Studio](https://aistudio.google.com/) to power the remediation engine.
    

> [!NOTE]
> 
> Credentials are encrypted using AES-256-GCM with a machine-bound key and stored safely on your local OS, never in the repository.

----------

## Usage

Navigate to any local Git repository that is connected to a remote GitHub repository with an active GitHub Actions workflow. Instead of running the standard `git push`, use:

```bash
auditor push
```

### What happens next?

1.  The tool authenticates and pushes your current branch to `origin`.
    
2.  The terminal launches a **live polling dashboard**.
    
3.  **If it passes:** It triggers post-deployment DAST scanning via OWASP ZAP Docker.
    
4.  **If it fails:** It downloads the failing job logs, sends them to Gemini, and prints a double-bordered UI report with the exact OWASP category and remediation instructions.
    

----------

## CLI Commands

| Command | Description |
|---|---|
| `auditor init` | Initialize the local credential vault (GitHub PAT + Gemini API Key) |
| `auditor push` | Push code and launch the live CI/CD + AI security dashboard |
| `auditor push -t <url>` | Push code and run DAST scan against a custom target URL |
| `auditor status` | Check recent CI/CD pipeline runs without pushing |
| `auditor preflight` | Run local security checks (secrets, IaC, SCA) before pushing |
| `auditor reset` | Clear all stored credentials from the local vault |

----------

## Architecture Breakdown

| Component | Responsibility |
|---|---|
| `src/commands/` | Contains the interactive TUI commands (`init.js`, `push.js`, `status.js`, `preflight.js`, `reset.js`). |
| `src/core/github.js` | Handles Git operations and utilizes `@octokit/rest` for parsing workflow logs. |
| `src/core/ai.js` | Integrates `@google/generative-ai` with strict JSON schemas for predictable remediation. |
| `src/core/scanner.js` | Executes OWASP ZAP Docker DAST scans with injection-safe `child_process.execFile`. |
| `src/config/vault.js` | Manages encrypted local credential storage using AES-256-GCM via `conf`. |
| `src/ui/` | Reusable UI components: reports (boxen), spinners (ora), tables (cli-table3). |
| `src/utils/` | Shared utilities for file system operations, logging, and async helpers. |

----------

## Contributing

Built to shift security left. 

1.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
    
2.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
    
3.  Push to the branch (`git push origin feature/AmazingFeature`)
    
4.  Open a Pull Request