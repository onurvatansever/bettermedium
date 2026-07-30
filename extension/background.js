import { runConcurrent } from "./lib/batch-runner.js";
import { readCustomPublicationRedirect } from "./lib/redirect-utils.js";
import { checkStory, unknownResult } from "./lib/story-checker.js";
import {
  collectArticleCandidates,
  fingerprintCandidates
} from "./lib/url-utils.js";

const JOB_STORAGE_KEY = "analysisJob";
const JOB_SCHEMA_VERSION = 2;
const MAX_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 10_000;

let activeRun = null;
let permissionRetry = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function saveJob(job) {
  if (activeRun && activeRun.id !== job.id) {
    return;
  }
  await browser.storage.session.set({ [JOB_STORAGE_KEY]: clone(job) });
}

async function getStoredJob() {
  const stored = await browser.storage.session.get(JOB_STORAGE_KEY);
  return stored[JOB_STORAGE_KEY] ?? null;
}

function createJob(message) {
  return {
    id: crypto.randomUUID(),
    schemaVersion: JOB_SCHEMA_VERSION,
    fingerprint: message.fingerprint,
    status: "running",
    total: message.candidates.length,
    completed: 0,
    candidates: message.candidates,
    results: [],
    free: [],
    lockedCount: 0,
    unknownCount: 0,
    requiredOrigins: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null
  };
}

function publicJob(job) {
  return {
    id: job.id,
    schemaVersion: job.schemaVersion,
    fingerprint: job.fingerprint,
    status: job.status,
    total: job.total,
    completed: job.completed,
    free: job.free,
    lockedCount: job.lockedCount,
    unknownCount: job.unknownCount,
    requiredOrigins: job.requiredOrigins ?? [],
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error
  };
}

function rebuildSummary(job) {
  job.completed = job.results.length;
  job.free = job.results
    .filter(({ result }) => result.status === "free")
    .sort((left, right) => left.index - right.index)
    .map(({ result }) => result);
  job.lockedCount = job.results.filter(({ result }) => result.status === "locked").length;
  job.unknownCount = job.results.filter(({ result }) => result.status === "unknown").length;
  job.requiredOrigins = [
    ...new Set(
      job.results
        .map(({ result }) => result.requiredOrigin)
        .filter(Boolean)
    )
  ].sort();
}

async function analyzeCandidate(candidate, run) {
  const controller = new AbortController();
  run.controllers.add(controller);

  try {
    const result = await checkStory(candidate, {
      signal: controller.signal,
      timeoutMs: REQUEST_TIMEOUT_MS
    });

    if (
      result.status === "unknown" &&
      result.reason === "network_error"
    ) {
      const requiredOrigin = run.redirectOrigins.get(candidate.storyId);
      if (requiredOrigin) {
        return {
          ...result,
          reason: "permission_required",
          requiredOrigin
        };
      }
    }

    return result;
  } finally {
    run.controllers.delete(controller);
  }
}

async function runJob(job) {
  if (activeRun && activeRun.id !== job.id) {
    activeRun.cancelled = true;
    for (const controller of activeRun.controllers) {
      controller.abort();
    }
  }

  const run = {
    id: job.id,
    cancelled: false,
    controllers: new Set(),
    redirectOrigins: new Map(),
    storyIds: new Set(job.candidates.map(({ storyId }) => storyId))
  };
  activeRun = run;

  const completedIndexes = new Set(job.results.map(({ index }) => index));
  const pending = job.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => !completedIndexes.has(index));

  try {
    await runConcurrent(
      pending,
      ({ candidate }) => analyzeCandidate(candidate, run),
      {
        concurrency: MAX_CONCURRENCY,
        shouldStop: () => run.cancelled || activeRun?.id !== job.id,
        onError: (_error, { candidate }) =>
          unknownResult(candidate, "unexpected_error"),
        onSettled: async (result, _position) => {
          const index = pending[_position].index;
          job.results.push({ index, result });
          rebuildSummary(job);
          await saveJob(job);
        }
      }
    );

    if (!run.cancelled && activeRun?.id === job.id) {
      job.status = "completed";
      job.finishedAt = new Date().toISOString();
      rebuildSummary(job);
      await saveJob(job);
    }
  } catch {
    if (!run.cancelled && activeRun?.id === job.id) {
      job.status = "error";
      job.error = "analysis_failed";
      job.finishedAt = new Date().toISOString();
      await saveJob(job);
    }
  } finally {
    if (activeRun?.id === job.id) {
      activeRun = null;
    }
  }

  return publicJob(job);
}

async function startAnalysis(message) {
  const job = createJob(message);
  await browser.storage.session.set({ [JOB_STORAGE_KEY]: clone(job) });
  return runJob(job);
}

async function getStateAndResumeIfNeeded() {
  const job = await getStoredJob();
  if (!job) {
    return null;
  }

  if (job.status === "running" && activeRun?.id !== job.id) {
    void runJob(job);
  }

  return publicJob(job);
}

async function rerunStoredJobAfterPermission() {
  const job = await getStoredJob();
  if (!job || job.schemaVersion !== JOB_SCHEMA_VERSION) {
    return null;
  }

  if (
    job.status === "running" ||
    (job.status === "completed" && (job.requiredOrigins?.length ?? 0) === 0)
  ) {
    return publicJob(job);
  }

  if (
    job.status !== "completed" ||
    !job.requiredOrigins?.length ||
    !job.candidates?.length
  ) {
    return null;
  }

  const origins = job.requiredOrigins.map((origin) => `${origin}/*`);
  const granted = await browser.permissions.contains({ origins });
  if (!granted) {
    return publicJob(job);
  }

  return startAnalysis({
    candidates: job.candidates,
    fingerprint: job.fingerprint
  });
}

function retryAfterPermission() {
  if (!permissionRetry) {
    permissionRetry = rerunStoredJobAfterPermission().finally(() => {
      permissionRetry = null;
    });
  }

  return permissionRetry;
}

function isGmailContentScript(sender) {
  try {
    return new URL(sender?.tab?.url).hostname === "mail.google.com";
  } catch {
    return false;
  }
}

async function analyzeGmailDigest(message) {
  const candidates = collectArticleCandidates(message.links);
  if (candidates.length === 0) {
    return null;
  }

  const fingerprint = fingerprintCandidates(candidates);
  const existing = await getStoredJob();
  if (
    existing?.schemaVersion === JOB_SCHEMA_VERSION &&
    existing.fingerprint === fingerprint &&
    ["running", "completed"].includes(existing.status)
  ) {
    if (existing.status === "running" && activeRun?.id !== existing.id) {
      void runJob(existing);
    }
    return publicJob(existing);
  }

  return startAnalysis({ candidates, fingerprint });
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "START_ANALYSIS") {
    return startAnalysis(message);
  }

  if (message?.type === "GET_ANALYSIS_STATE") {
    return getStateAndResumeIfNeeded();
  }

  if (message?.type === "RETRY_AFTER_PERMISSION") {
    return retryAfterPermission();
  }

  if (
    message?.type === "ANALYZE_GMAIL_DIGEST" &&
    isGmailContentScript(sender)
  ) {
    return analyzeGmailDigest(message);
  }

  return undefined;
});

browser.permissions.onAdded.addListener(() => {
  void retryAfterPermission();
});

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (!activeRun || activeRun.cancelled) {
      return;
    }

    const redirect = readCustomPublicationRedirect(
      details.url,
      details.redirectUrl,
      activeRun.storyIds
    );
    if (redirect) {
      activeRun.redirectOrigins.set(redirect.storyId, redirect.origin);
    }
  },
  {
    urls: [
      "https://medium.com/*",
      "https://*.medium.com/*"
    ]
  }
);
