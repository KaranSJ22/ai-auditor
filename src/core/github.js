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

    // Dynamically parse owner and repo from the remote URL this supports https and ssh
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


export async function getFailedJobLog(octokit, owner, repo, run_id) {
    // 1. Get all jobs for this specific workflow run
    const jobsResponse = await octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id,
    });

    // 2. Find the exact job that failed
    const failedJob = jobsResponse.data.jobs.find(job => job.conclusion === 'failure');
    
    if (!failedJob) {
        throw new Error('Could not find a specifically failed job in this workflow run.');
    }

    // 3. The Anti-Race-Condition Pause 
    // Give GitHub's servers 2 seconds to finalize and upload the text logs
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Download the raw text logs using the correct Job ID
    const logResponse = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
        owner,
        repo,
        job_id: failedJob.id,
    });

    return logResponse.data;
}