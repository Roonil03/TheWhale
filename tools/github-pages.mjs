// Repository-admin helper. Credentials stay in memory and are never logged.
import { execFileSync } from 'node:child_process';

const operation = process.argv[2] || 'status';
const allowed = new Set(['status', 'configure', 'runs']);
if (!allowed.has(operation)) throw new Error('Use status, configure, or runs');
const credential = execFileSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
});
const password = credential.split('\n').find(line => line.startsWith('password='))?.slice(9);
if (!password) throw new Error('No GitHub credential is available');
const base = 'https://api.github.com/repos/Roonil03/TheWhale';
const headers = { Authorization: `Bearer ${password}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const route = operation === 'runs' ? '/actions/runs?per_page=5' : '/pages';
const response = await fetch(base + route, {
  headers, method: operation === 'configure' ? 'POST' : 'GET',
  ...(operation === 'configure' ? { body: JSON.stringify({ build_type: 'workflow' }) } : {}),
});
const result = await response.json();
if (operation === 'runs' && response.ok) {
  console.log(JSON.stringify(result.workflow_runs.map(run => ({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, sha: run.head_sha, url: run.html_url })), null, 2));
} else {
  console.log(JSON.stringify({ status: response.status, message: result.message, url: result.html_url, build_type: result.build_type }, null, 2));
}
if (!response.ok) process.exitCode = 1;
