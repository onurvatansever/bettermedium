import { runConcurrent } from "./lib/batch-runner.js";
import { checkStory, unknownResult } from "./lib/story-checker.js";

const JOB_STORAGE_KEY = "analysisJob";
const MAX_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 10_000;

let activeRun = null;

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
    fingerprint: message.fingerprint,
    status: "running",
    total: message.candidates.length,
    completed: 0,
    candidates: message.candidates,
    results: [],
    free: [],
    lockedCount: 0,
    unknownCount: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null
  };
}

function publicJob(job) {
  return {
    id: job.id,
    fingerprint: job.fingerprint,
    status: job.status,
    total: job.total,
    completed: job.completed,
    free: job.free,
    lockedCount: job.lockedCount,
    unknownCount: job.unknownCount,
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
}

async function analyzeCandidate(candidate, run) {
  const controller = new AbortController();
  run.controllers.add(controller);

  try {
    return await checkStory(candidate, {
      signal: controller.signal,
      timeoutMs: REQUEST_TIMEOUT_MS
    });
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
    controllers: new Set()
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

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "START_ANALYSIS") {
    return startAnalysis(message);
  }

  if (message?.type === "GET_ANALYSIS_STATE") {
    return getStateAndResumeIfNeeded();
  }

  return undefined;
});
