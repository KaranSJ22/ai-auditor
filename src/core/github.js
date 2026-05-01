import { simpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { getCredentials } from '../config/vault.js';

const git = simpleGit();

export async function getGitDetails() {
    const status = await git.status();
    const branch = status.current;

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    
    if (!origin) throw new Error("No remote 'origin' found. Is this a cloned git repository?");

    // Dynamically parse owner and repo from the remote URL (supports https and ssh)
    const url = origin.refs.fetch;
    const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);
    
    if (!match) throw new Error("Could not parse GitHub owner/repo from remote URL.");

    return { branch, owner: match[1], repo: match[2] };
}

export async function pushCode(branch, owner, repo) {
    const { githubPat } = getCredentials();
    if (!githubPat) throw new Error("GitHub PAT missing from vault.");
    
    // Inject the PAT directly into the URL to bypass the system Git prompt
    const authRemote = `https://${githubPat}@github.com/${owner}/${repo}.git`;
    
    await git.push(authRemote, branch);
}

export function getOctokit() {
    const { githubPat } = getCredentials();
    if (!githubPat) throw new Error("GitHub PAT missing from vault.");
    return new Octokit({ auth: githubPat });
}

export async function getLatestWorkflowRun(octokit, owner, repo, branch) {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch,
        per_page: 1
    });
    return data.workflow_runs[0];
}

export async function getFailedJobLog(octokit, owner, repo, runId) {
    try {
        // 1. List all jobs for the specific workflow run
        const { data: { jobs } } = await octokit.rest.actions.listJobsForWorkflowRun({
            owner,
            repo,
            run_id: runId
        });

        // 2. Find the specific job that failed
        const failedJob = jobs.find(job => job.conclusion === 'failure');
        if (!failedJob) return "Could not isolate the failed job log.";

        // 3. Fetch the raw text log for that job
        const { data: logData } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
            owner,
            repo,
            job_id: failedJob.id
        });

        // Truncate log if it's too massive (to save Gemini token limits)
        const logString = String(logData);
        return logString.length > 15000 ? logString.slice(-15000) : logString;

    } catch (error) {
        throw new Error(`Failed to download logs: ${error.message}`);
    }
}