# AIAuditor

**A terminal-native, AI-powered DevSecOps engine built for the Breaking Apps Hackathon.**

The AIAuditor bridges the gap between local development, remote CI/CD pipelines, and generative AI. It eliminates context-switching by allowing developers to push code, monitor GitHub Actions live, and receive automated, AI-driven security remediation directly inside their terminal.

----------

##  Core Features

-   **Local Credential Vault:** Securely stores your GitHub PAT and Gemini API keys locally, bypassing clunky system git prompts.
    
-   **Unified Push & Live Polling:** Automatically pushes your branch and launches a live TUI dashboard to poll your GitHub Actions pipeline status.
    
-   **AI-Powered Remediation:** If the build fails a security scan, the auditor fetches the exact workflow logs and pipes them through **Gemini 1.5 Flash** to extract the OWASP vulnerability, explain it, and provide the exact code to fix it.
    
-   **Post-Deployment DAST:** Natively spins up an OWASP ZAP Docker container to run baseline Dynamic Application Security Testing against staging URLs.
    
-   **Enterprise Observability:** Silently fires off critical vulnerability metrics to centralized enterprise dashboards (e.g., Datadog) for organizational tracking.
    

----------

## Prerequisites

Before installing, ensure you have the following installed on your system:

-   **Node.js** (v18 or higher recommended)
    
-   **Git**
    
-   **Docker** (Required for the OWASP ZAP DAST scanner)
    

----------

##  Installation & Setup

### 1. Clone the Repository

Fork this repository to your own GitHub account, then clone it to your local machine:

Bash

```
git clone https://github.com/YOUR_USERNAME/ai-devsecops-auditor.git
cd ai-devsecops-auditor

```

### 2. Install Dependencies

Bash

```
npm install

```

### 3. Link the CLI Globally

This allows you to run the `auditor` command from any directory on your system:

Bash

```
npm link

```

----------

##  Configuration

Before using the tool, you must initialize your local credential vault. Run the following command anywhere in your terminal:

Bash

```
auditor init

```

**You will be prompted for:**

1.  **GitHub Personal Access Token (PAT):** Must have `repo` and `workflow` scopes to push code and read GitHub Actions logs.
    
2.  **Gemini API Key:** [Get a free API key from Google AI Studio](https://aistudio.google.com/) to power the remediation engine.
    

> [!NOTE]
> 
> Credentials are encrypted and stored safely on your local OS, never in the repository.

----------

##  Usage

Navigate to any local Git repository that is connected to a remote GitHub repository with an active GitHub Actions workflow. Instead of running the standard `git push`, use:

Bash

```
auditor push

```

### What happens next?

1.  The tool authenticates and pushes your current branch to `origin`.
    
2.  The terminal clears and launches a **live polling dashboard**.
    
3.  **If it passes:** It triggers post-deployment protocols (DAST scanning & Enterprise Observability metrics).
    
4.  **If it fails:** It downloads the failing job logs, sends them to Gemini, and prints a double-bordered UI report with the exact OWASP category and remediation instructions.
    

----------

## Architecture Breakdown

**Component**

**Responsibility**

`src/commands/`

Contains the interactive TUI commands (`init.js`, `push.js`).

`src/core/github.js`

Handles Git operations and utilizes `@octokit/rest` for parsing workflow logs.

`src/core/ai.js`

Integrates `@google/generative-ai` with strict JSON schemas for predictable remediation.

`src/core/monitoring.js`

Executes parallel tasks via `shelljs` for Docker DAST scans and `axios` for telemetry.

`src/config/vault.js`

Manages the local `conf` storage engine.

----------

##  Contributing

Built to shift security left. 

1.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
    
2.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
    
3.  Push to the branch (`git push origin feature/AmazingFeature`)
    
4.  Open a Pull Request