import { simpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { getCredentials } from '../config/vault.js';
import { sleep } from '../utils/sleep.js';

const git = simpleGit();

export async function getGitDetails() {
    const status = await git.status();
    const branch = status.current;

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');

    if (!origin) throw new Error("No remote 'origin' found. Is this a cloned git repository?");

    const url = origin.refs.fetch;
    const match = url.match(/github\.com[:/](.+)\/(.+?)(\.git)?$/);

    if (!match) throw new Error("Could not parse GitHub owner/repo from remote URL.");

    //  FIX A3: Get the exact Commit SHA so we track the right workflow run
    const headSha = await git.revparse(['HEAD']);

    return { branch, owner: match[1], repo: match[2], headSha };
}

export async function pushCode(branch, owner, repo) {
    const { githubPat } = getCredentials();
    if (!githubPat) throw new Error("GitHub PAT missing from vault.");

    //  FIX S2: Prevent PAT Leakage
    
    // We encode the PAT and pass it as an HTTP extra header. 
    // This securely injects the token in-memory and bypasses the URL completely.
    const authHeader = `AUTHORIZATION: basic ${Buffer.from(githubPat + ':x-oauth-basic').toString('base64')}`;

    await git.raw([
        '-c', `http.extraHeader=${authHeader}`,
        'push',
        'origin',
        branch
    ]);
}

export function getOctokit() {
    const { githubPat } = getCredentials();
    if (!githubPat) throw new Error("GitHub PAT missing from vault.");
    return new Octokit({ auth: githubPat });
}

//  FIX A3: Require the head_sha to prevent race conditions
export async function getLatestWorkflowRun(octokit, owner, repo, branch, head_sha) {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch,
        head_sha, // Strictly match the commit we just pushed!
        per_page: 1
    });
    return data.workflow_runs[0] || null;
}

export async function getFailedJobLog(octokit, owner, repo, run_id) {
    const jobsResponse = await octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id,
    });

    const failedJob = jobsResponse.data.jobs.find(job => job.conclusion === 'failure');

    if (!failedJob) {
        throw new Error('Could not find a specifically failed job in this workflow run.');
    }

    // Give GitHub's servers 2 seconds to finalize and upload the text logs
    await sleep(2000);

    const logResponse = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
        owner,
        repo,
        job_id: failedJob.id,
    });

    return logResponse.data;
}