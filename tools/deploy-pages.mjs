import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const failures = new Set([
  "deployment_failed",
  "deployment_content_failed",
  "deployment_cancelled",
  "deployment_lost",
]);

// GitHub's Pages action uses the same create/status endpoints and OIDC token.
export async function deployPages(
  env,
  request = fetch,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repository,
    GITHUB_SHA: sha,
    PAGES_ARTIFACT_ID: artifact,
    ACTIONS_ID_TOKEN_REQUEST_URL: oidcUrl,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: oidcRequestToken,
  } = env;
  if (
    !token ||
    !oidcUrl ||
    !oidcRequestToken ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository || "") ||
    !/^[a-f0-9]{40}$/i.test(sha || "") ||
    !/^\d+$/.test(artifact || "")
  ) {
    throw new Error("Missing or invalid Pages deployment configuration");
  }
  async function json(url, options) {
    const response = await request(url, {
      ...options,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Pages request failed (HTTP ${response.status})`);
    return response.json();
  }
  const oidc = await json(oidcUrl, {
    headers: { Authorization: `Bearer ${oidcRequestToken}` },
  });
  if (typeof oidc.value !== "string" || !oidc.value)
    throw new Error("OIDC token missing");
  const base = `${env.GITHUB_API_URL || "https://api.github.com"}/repos/${repository}/pages/deployments`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const deployment = await json(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      artifact_id: Number(artifact),
      pages_build_version: sha,
      oidc_token: oidc.value,
      environment: "github-pages",
    }),
  });
  const id = String(
    deployment.id || deployment.status_url?.split("/").pop() || sha,
  );
  if (
    !/^[\w-]+$/.test(id) ||
    typeof deployment.page_url !== "string" ||
    !/^https:\/\/[^\s]+$/.test(deployment.page_url)
  ) {
    throw new Error("Invalid Pages deployment response");
  }
  const statusUrl = `${base}/${id}`;
  const deadline = Date.now() + 10 * 60 * 1000;
  for (let attempt = 0; attempt < 120 && Date.now() < deadline; attempt++) {
    const { status } = await json(statusUrl, { headers });
    if (status === "succeed") return deployment.page_url;
    if (failures.has(status))
      throw new Error(`Pages deployment failed: ${status}`);
    await delay(5000);
  }
  await request(`${statusUrl}/cancel`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30000),
  });
  throw new Error("Pages deployment timed out");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const pageUrl = await deployPages(process.env);
    await appendFile(process.env.GITHUB_OUTPUT, `page_url=${pageUrl}\n`);
    console.log("Pages deployment succeeded.");
  } catch (error) {
    // Avoid printing responses or request objects, which can contain credentials.
    console.error(
      error instanceof Error &&
        /^Pages |^Missing |^Invalid |^OIDC /.test(error.message)
        ? error.message
        : "Pages deployment request failed",
    );
    process.exitCode = 1;
  }
}
