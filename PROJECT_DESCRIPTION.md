# AI DevSecOps Auditor -- Complete Project Description

> **Package name:** `ai-devsecops-auditor`  
> **Version:** `1.0.0`  
> **License:** ISC  
> **Runtime:** Node.js (ESM, `"type": "module"`)  
> **Repository:** https://github.com/KaranSJ22/ai-auditor

---

## 1. Overview

**AI DevSecOps Auditor** is a terminal-native, AI-powered Command-Line Interface (CLI) tool that unifies developer workflows into a single toolchain:

1. **Authenticated Git push** -- pushes your current branch to GitHub using a locally stored Personal Access Token (PAT) via secure HTTP headers, bypassing system Git credential prompts.
2. **Live CI/CD monitoring** -- polls GitHub Actions every 5 seconds and displays a live TUI (Text User Interface) dashboard showing workflow run status.
3. **AI-driven security remediation** -- if the pipeline fails, it downloads the raw failure logs, sanitizes them, sends them to **Google Gemini 2.5 Flash**, and prints a structured OWASP-mapped remediation report directly in the terminal.
4. **Post-deployment DAST scanning** -- executes OWASP ZAP baseline scans via Docker against configurable target URLs after successful CI builds.
5. **Local preflight security scanning** -- checks for exposed secrets, lints Dockerfiles, and runs dependency audits before pushing.
6. **Encrypted credential vault** -- stores API keys and tokens using AES-256-GCM encryption with machine-bound key derivation.

The project is registered as a global CLI tool (`auditor`) via `npm link`, so it can be invoked from any directory on the developer's machine.

---

## 2. Repository Structure

```
ai-auditor/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI pipeline
├── bin/
│   └── auditor.js              # CLI entry point (shebang wrapper)
├── src/
│   ├── cli.js                  # Commander program definition & command routing
│   ├── commands/
│   │   ├── init.js             # `auditor init` — credential vault setup
│   │   ├── push.js             # `auditor push` — push + live dashboard + AI report
│   │   ├── preflight.js        # `auditor preflight` — local security scanning
│   │   ├── reset.js            # `auditor reset` — clear stored credentials
│   │   └── status.js           # `auditor status` — check pipeline runs
│   ├── config/
│   │   └── vault.js            # AES-256-GCM encrypted credential store
│   ├── core/
│   │   ├── ai.js               # Gemini API integration & OWASP analysis
│   │   ├── github.js           # Git operations & GitHub Actions API (Octokit)
│   │   └── scanner.js          # OWASP ZAP Docker DAST scanner
│   ├── ui/
│   │   ├── reports.js          # Boxen-based AI report rendering
│   │   ├── spinners.js         # Reusable ora spinner components
│   │   └── tables.js           # cli-table3 workflow table rendering
│   └── utils/
│       ├── fileSystem.js       # File system helpers (report saving)
│       ├── logger.js           # Centralized chalk-based logging utility
│       └── sleep.js            # Shared async sleep helper
├── tests/
│   ├── fileSystem.test.js      # Unit test for report file generation
│   └── reports.test.js         # Unit test for UI report rendering
├── .gitignore
├── package.json
├── package-lock.json
├── PROJECT_DESCRIPTION.md
└── readme.md
```

---

## 3. File-by-File Breakdown

---

### 3.1 Root Files

#### `.gitignore`
Excludes the following from version control:

| Ignored Pattern | Reason |
|---|---|
| `node_modules/` | npm dependency directory (restored via `npm install`) |
| `.env` | Environment variable files (security) |
| `dist/` | Build output directory |
| `build/` | Alternative build output |
| `*.log` | Any runtime log files |
| `audit-reports/` | Generated audit report files |

---

#### `package.json`
The npm package manifest. Key fields:

| Field | Value | Notes |
|---|---|---|
| `name` | `ai-devsecops-auditor` | Published/linked package name |
| `version` | `1.0.0` | Initial release |
| `type` | `module` | Enables native ES Modules (`import`/`export`) throughout |
| `main` | `src/cli.js` | Module entry point |
| `bin.auditor` | `bin/auditor.js` | Makes `auditor` a globally available shell command after `npm link` |

**Direct dependencies:**

| Package | Version | Purpose |
|---|---|---|
| `@google/generative-ai` | `^0.24.1` | Google Gemini SDK for AI-powered log analysis |
| `@octokit/rest` | `^22.0.1` | GitHub REST API client -- Actions runs and job logs |
| `boxen` | `^8.0.1` | Renders bordered terminal boxes for the AI report |
| `chalk` | `^5.6.2` | Terminal string styling (colors, bold) |
| `cli-table3` | `^0.6.5` | Formatted terminal tables for workflow run display |
| `commander` | `^14.0.3` | CLI framework -- parses commands and routes to handlers |
| `conf` | `^15.1.0` | Persistent, cross-platform local config/credential storage |
| `inquirer` | `^13.4.2` | Interactive terminal prompts (password input with masking) |
| `ora` | `^9.4.0` | Elegant terminal spinners for async operation feedback |
| `shelljs` | `^0.10.0` | Shell command execution for preflight scanning |
| `simple-git` | `^3.36.0` | Node.js wrapper for Git CLI operations |

---

### 3.2 `bin/` Directory

#### `bin/auditor.js`
```js
#!/usr/bin/env node
import '../src/cli.js';
```
The binary entry point registered with npm. Contains a Unix shebang so the OS can execute it directly. Its sole job is to import `src/cli.js`, delegating all logic there.

---

### 3.3 `src/cli.js`

The Commander.js program definition and central command router.

**Registered commands:**
- `init` -- calls `initCommand()` from `commands/init.js`
- `push` -- calls `pushCommand()` from `commands/push.js` (accepts `-t, --target <url>`)
- `status` -- calls `statusCommand()` from `commands/status.js`
- `preflight` -- calls `preflightCommand()` from `commands/preflight.js`
- `reset` -- calls `resetCommand()` from `commands/reset.js`

---

### 3.4 `src/commands/` Directory

#### `src/commands/init.js`
**Command:** `auditor init`

Interactive credential vault initialization with input validation.

**Behaviour:**
1. Checks for existing stored credentials via `getCredentials()`.
2. Prompts for GitHub PAT (validates `ghp_` or `github_pat_` prefix) -- only if not already stored.
3. Prompts for Gemini API Key (validates non-empty) -- only if not already stored.
4. Calls `saveCredentials()` only when new credentials are provided.

---

#### `src/commands/push.js`
**Command:** `auditor push [-t <url>]`

The core command and main workflow orchestrator.

**Workflow:**
1. Retrieves git details (branch, owner, repo, HEAD SHA).
2. Pushes code using secure HTTP header authentication (PAT never embedded in URL).
3. Polls GitHub Actions every 5 seconds with a 5-minute timeout (60 attempts).
4. On success: runs OWASP ZAP DAST scan against target URL (default: `http://localhost:3000`).
5. On failure: downloads job logs, sanitizes content, sends to Gemini AI, renders OWASP report.
6. Saves reports to disk as properly formatted markdown files.

---

#### `src/commands/preflight.js`
**Command:** `auditor preflight`

Local security scanning before pushing code.

**Checks performed:**
1. **Secret Scanning:** Detects `.env` files and verifies they are listed in `.gitignore` using line-by-line pattern matching.
2. **IaC Linting:** Validates Dockerfiles for non-root USER instructions using regex matching.
3. **SCA Scanning:** Runs `npm audit` for Node.js projects or checks Python dependencies for security middleware.

---

#### `src/commands/status.js`
**Command:** `auditor status`

Fetches and displays the last 5 workflow runs for the current branch in a formatted table.

---

#### `src/commands/reset.js`
**Command:** `auditor reset`

Clears all stored credentials from the encrypted vault after user confirmation.

---

### 3.5 `src/config/vault.js`

The credential persistence layer using AES-256-GCM encryption.

**Security properties:**
- Generates a unique random salt per installation (stored in config).
- Derives a 32-byte AES key using `scrypt` with machine identity (username, hostname, architecture, platform).
- Each encryption operation uses a random 16-byte IV.
- GCM authentication tags prevent tampering.
- If the config file is moved to another machine, decryption fails silently.

**Exports:**

| Function | Behaviour |
|---|---|
| `saveCredentials(githubPat, geminiKey)` | Encrypts and stores credentials (only writes truthy values) |
| `getCredentials()` | Decrypts and returns `{ githubPat, geminiKey }` |
| `clearCredentials()` | Deletes all stored credentials and the installation salt |

---

### 3.6 `src/core/` Directory

#### `src/core/github.js`

All GitHub and Git interactions. Exports:

- **`getGitDetails()`** -- returns `{ branch, owner, repo, headSha }` parsed from git status and remote URL.
- **`pushCode(branch, owner, repo)`** -- pushes using base64-encoded PAT as an HTTP extra header (never embedded in URL).
- **`getOctokit()`** -- returns an authenticated Octokit instance.
- **`getLatestWorkflowRun(octokit, owner, repo, branch, head_sha)`** -- fetches the most recent run matching the exact commit SHA. Returns `null` if no run found.
- **`getFailedJobLog(octokit, owner, repo, run_id)`** -- downloads raw log text from the first failed job.

---

#### `src/core/ai.js`

Gemini AI integration with input sanitization.

- Sanitizes log content before sending (truncates to 15,000 characters, strips prompt injection patterns).
- Uses `gemini-2.5-flash` model with strict JSON response schema.
- Returns structured `{ owaspCategory, explanation, remediation }` object.

---

#### `src/core/scanner.js`

OWASP ZAP DAST scanner with command injection prevention.

- Validates target URL using the `URL` constructor (protocol restricted to http/https).
- Adjusts `localhost` to `host.docker.internal` for Docker networking.
- Executes scan using `child_process.execFile` (not shell) with arguments as an array, preventing shell metacharacter injection.

---

### 3.7 `src/ui/` Directory

| File | Purpose |
|---|---|
| `reports.js` | Renders boxen-bordered AI remediation reports with OWASP category, explanation, and remediation |
| `spinners.js` | Factory function for standardized ora spinners with consistent styling |
| `tables.js` | Renders cli-table3 workflow history tables with color-coded status/conclusion columns |

---

### 3.8 `src/utils/` Directory

| File | Purpose |
|---|---|
| `fileSystem.js` | Saves AI audit reports as properly formatted markdown files to `audit-reports/` |
| `logger.js` | Centralized chalk-based logger with info, success, warn, error, header, and divider methods |
| `sleep.js` | Shared async sleep utility used by push.js and github.js |

---

### 3.9 `tests/` Directory

| File | Tests |
|---|---|
| `fileSystem.test.js` | Verifies `saveReportToDisk` creates valid markdown files with correct content, cleans up after itself |
| `reports.test.js` | Verifies `renderSecurityReport` outputs correct OWASP data and boxen title |

---

### 3.10 `.github/workflows/ci.yml`

GitHub Actions CI pipeline that runs on push and PR to `main`:
- Checks out code and sets up Node.js 20
- Installs dependencies with `npm ci`
- Runs `npm audit` for dependency scanning
- Executes the test suite
- Runs the preflight security scan

---

## 4. CLI Commands Reference

| Command | Description | Status |
|---|---|---|
| `auditor init` | Initializes the local credential vault (GitHub PAT + Gemini API Key) | Implemented |
| `auditor push` | Pushes current branch, monitors CI/CD live, AI-analyzes failures | Implemented |
| `auditor push -t <url>` | Same as push, with a custom DAST target URL | Implemented |
| `auditor status` | Displays recent workflow run history in a formatted table | Implemented |
| `auditor preflight` | Runs local security scans (secrets, IaC, SCA) | Implemented |
| `auditor reset` | Clears all stored credentials from the vault | Implemented |

---

## 5. End-to-End Data Flow

```
auditor push
    |
    v
[github.js] getGitDetails()
  Parse branch, owner, repo, headSha from .git remote URL
    |
    v
[github.js] pushCode()
  Inject PAT via HTTP extra header -> git push to origin
    |
    v
[github.js] getOctokit()
  Create authenticated GitHub API client
    |
    v
  +-------------------------------------------+
  |  POLL LOOP every 5,000ms (max 60 tries)   |
  |  getLatestWorkflowRun(headSha) -> TUI      |
  +-------------------------------------------+
    |
  +-+----------------+
  |                  |
SUCCESS            FAILURE
  |                  |
  v                  v
[scanner.js]     getFailedJobLog()
DAST Scan        Download raw log
via ZAP              |
  |                  v
  v           [ai.js] analyzeFailureLog()
Print OK      Sanitize + Truncate log
              Send to Gemini 2.5 Flash
              Receive { owaspCategory, explanation, remediation }
                     |
                     v
              [reports.js] renderSecurityReport()
              [fileSystem.js] saveReportToDisk()
```

---

## 6. Credential Management

Credentials are encrypted using AES-256-GCM and stored via the `conf` package under project name `ai-devsecops-auditor`.

| OS | Storage Path |
|---|---|
| Windows | `%APPDATA%\ai-devsecops-auditor\config.json` |
| macOS | `~/Library/Preferences/ai-devsecops-auditor/config.json` |
| Linux | `~/.config/ai-devsecops-auditor/config.json` |

**Security properties:**
- AES-256-GCM encryption with random IV per operation
- Machine-bound key derived via scrypt from username, hostname, architecture, and platform
- Per-installation random salt (not hardcoded)
- GCM authentication tag prevents tampering
- Credentials never written to the repository
- PAT masked during input, never embedded in git remote URLs
- `auditor reset` command available to clear all stored credentials

---

## 7. Architecture Patterns

| Pattern | Implementation |
|---|---|
| **ES Modules** | All files use `import`/`export` (enforced by `"type": "module"`) |
| **Layered Architecture** | `commands/` -> `core/` -> `config/` separation of concerns |
| **Schema-Enforced AI Output** | Gemini response schema guarantees parseable, structured JSON |
| **Secure PAT Transport** | PAT injected via HTTP extra header, never in URL |
| **Command Injection Prevention** | DAST scanner uses `child_process.execFile` with array arguments |
| **Log Sanitization** | CI/CD logs truncated and stripped of prompt injection patterns before AI |
| **Machine-Bound Encryption** | AES-256-GCM with scrypt-derived key from machine identity |
| **Conditional Vault Writes** | `saveCredentials` only writes truthy values, preventing overwrites |
| **Input Validation** | Credential format validation on GitHub PAT and API key inputs |
| **CI/CD Pipeline** | GitHub Actions workflow for automated testing and security scanning |

---

## 8. Implementation Status

| Area | Status |
|---|---|
| CLI routing (`cli.js`) | Complete -- 5 commands registered |
| Encrypted credential vault (`vault.js`) | Complete -- AES-256-GCM with machine-bound keys |
| `auditor init` command | Complete -- interactive, masked, validated prompts |
| `auditor push` command | Complete -- full push, poll, DAST, AI report pipeline |
| `auditor status` command | Complete -- formatted workflow history table |
| `auditor preflight` command | Complete -- secrets, IaC, SCA scanning |
| `auditor reset` command | Complete -- credential clearing with confirmation |
| GitHub integration (`github.js`) | Complete -- push, run polling, log download |
| Gemini AI integration (`ai.js`) | Complete -- Gemini 2.5 Flash, strict JSON schema, log sanitization |
| DAST Scanner (`scanner.js`) | Complete -- OWASP ZAP Docker, injection-safe execution |
| UI helpers (`ui/*.js`) | Complete -- reports, spinners, tables |
| Utils (`utils/*.js`) | Complete -- file system, logger, sleep |
| Tests | Partial -- 2 unit test files covering reports and file system |
| CI/CD Pipeline | Complete -- GitHub Actions workflow for test and audit |

---

## 9. Setup & Prerequisites

```bash
# Prerequisites: Node.js v18+, Git, Docker

git clone https://github.com/KaranSJ22/ai-auditor.git
cd ai-auditor
npm install
npm link          # Register `auditor` as a global CLI command

auditor init      # Store GitHub PAT and Gemini API Key in encrypted local vault

cd /path/to/any-github-repo
auditor preflight # Run local security checks first
auditor push      # Push code and launch the live CI/CD + AI security dashboard
auditor status    # Check recent pipeline runs
auditor reset     # Clear credentials when needed
```

---

*Complete project analysis -- covers all files across all directories.*
