import test from "node:test";
import assert from "node:assert/strict";
import { deployPages } from "../tools/deploy-pages.mjs";

const env = {
  GITHUB_TOKEN: "github-secret",
  GITHUB_REPOSITORY: "owner/repo",
  GITHUB_SHA: "a".repeat(40),
  PAGES_ARTIFACT_ID: "42",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.example/token",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-secret",
};
const response = (data) => ({ ok: true, json: async () => data });

test("Pages deployment sends the artifact and waits for success", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return response({ value: "oidc-secret" });
    if (calls.length === 2)
      return response({ id: "123", page_url: "https://example.com/" });
    return response({ status: calls.length === 3 ? "queued" : "succeed" });
  };
  assert.equal(
    await deployPages(env, request, async () => {}),
    "https://example.com/",
  );
  assert.equal(calls.length, 4);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    artifact_id: 42,
    pages_build_version: env.GITHUB_SHA,
    oidc_token: "oidc-secret",
    environment: "github-pages",
  });
  assert.match(calls[3].url, /\/pages\/deployments\/123$/);
});

test("Pages deployment stops on a terminal failure", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    if (calls === 1) return response({ value: "oidc-secret" });
    if (calls === 2)
      return response({ id: "123", page_url: "https://example.com/" });
    return response({ status: "deployment_failed" });
  };
  await assert.rejects(
    deployPages(env, request, async () => {}),
    /deployment_failed/,
  );
  assert.equal(calls, 3);
});

test("Pages deployment rejects an API error without echoing its response", async () => {
  await assert.rejects(
    deployPages(env, async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "request-secret" }),
    })),
    (error) => {
      assert.equal(error.message, "Pages request failed (HTTP 403)");
      return true;
    },
  );
});

test("Pages deployment cancels after the polling timeout", async () => {
  let calls = 0;
  let cancelled = false;
  const request = async (url, options) => {
    calls++;
    if (calls === 1) return response({ value: "oidc-secret" });
    if (calls === 2)
      return response({ id: "123", page_url: "https://example.com/" });
    if (url.endsWith("/cancel")) {
      cancelled = options.method === "POST";
      return response({});
    }
    return response({ status: "queued" });
  };
  await assert.rejects(
    deployPages(env, request, async () => {}),
    /timed out/,
  );
  assert.equal(cancelled, true);
});

test("Pages status polling recovers from eventual consistency and transient failures", async () => {
  let polls = 0;
  const request = async (url, options) => {
    if (url === env.ACTIONS_ID_TOKEN_REQUEST_URL)
      return response({ value: "oidc-secret" });
    if (options.method === "POST")
      return response({ id: "123", page_url: "https://example.com/" });
    polls++;
    if (polls === 1) return { ok: false, status: 404 };
    if (polls === 2) return { ok: false, status: 503 };
    if (polls === 3) throw new TypeError("temporary network failure");
    return response({
      status: polls === 4 ? "deployment_attempt_error" : "succeed",
    });
  };
  assert.equal(
    await deployPages(env, request, async () => {}),
    "https://example.com/",
  );
  assert.equal(polls, 5);
});

test("Pages status polling cancels after repeated transient errors", async () => {
  let polls = 0;
  let cancelled = false;
  const request = async (url, options) => {
    if (url === env.ACTIONS_ID_TOKEN_REQUEST_URL)
      return response({ value: "oidc-secret" });
    if (url.endsWith("/cancel")) {
      cancelled = true;
      return response({});
    }
    if (options.method === "POST")
      return response({ id: "123", page_url: "https://example.com/" });
    polls++;
    return { ok: false, status: 503 };
  };
  await assert.rejects(
    deployPages(env, request, async () => {}),
    /repeated transient errors/,
  );
  assert.equal(polls, 6);
  assert.equal(cancelled, true);
});

test("Pages status polling fails immediately for a permanent authorization error", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    if (calls === 1) return response({ value: "oidc-secret" });
    if (calls === 2)
      return response({ id: "123", page_url: "https://example.com/" });
    return { ok: false, status: 403 };
  };
  await assert.rejects(
    deployPages(env, request, async () => {}),
    /HTTP 403/,
  );
  assert.equal(calls, 3);
});
