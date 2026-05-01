import Conf from 'conf';

const config = new Conf({ projectName: 'ai-devsecops-auditor' });

export function saveCredentials(githubPat, geminiKey) {
    if (githubPat) config.set('githubPat', githubPat);
    if (geminiKey) config.set('geminiKey', geminiKey);
}

export function getCredentials() {
    return {
        githubPat: config.get('githubPat'),
        geminiKey: config.get('geminiKey')
    };
}