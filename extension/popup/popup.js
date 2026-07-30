import {
  collectArticleCandidates,
  fingerprintCandidates
} from "../lib/url-utils.js";
import { extractVisibleLinksFromActivePage } from "../lib/page-extractor.js";

const elements = {
  emptyMessage: document.querySelector("#empty-message"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  progressBar: document.querySelector("#progress-bar"),
  progressText: document.querySelector("#progress-text"),
  results: document.querySelector("#results"),
  retryButton: document.querySelector("#retry-button"),
  statusPanel: document.querySelector("#status-panel"),
  statusText: document.querySelector("#status-text"),
  summary: document.querySelector("#summary")
};

let currentCandidates = [];
let currentFingerprint = null;

function showError(title, message, canRetry = false) {
  elements.statusPanel.hidden = true;
  elements.summary.hidden = true;
  elements.results.replaceChildren();
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  elements.emptyState.hidden = false;
  elements.retryButton.hidden = !canRetry;
}

function resultCard(result) {
  const card = document.createElement("article");
  card.className = "result-card";

  const copy = document.createElement("div");
  copy.className = "result-copy";

  const title = document.createElement("div");
  title.className = "result-title";
  title.textContent = result.title;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = result.accessType === "friend" ? "FRIEND LINK" : "HERKESE AÇIK";

  const link = document.createElement("a");
  link.className = "read-link";
  link.href = result.readUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Oku";

  copy.append(title, badge);
  card.append(copy, link);
  return card;
}

function renderJob(job) {
  if (!job) {
    return;
  }

  const total = Math.max(0, job.total ?? 0);
  const completed = Math.min(total, Math.max(0, job.completed ?? 0));
  const progress = total ? Math.max(4, Math.round((completed / total) * 100)) : 4;

  elements.emptyState.hidden = true;
  elements.statusPanel.hidden = false;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressText.textContent = `${completed}/${total}`;
  elements.statusText.textContent =
    job.status === "running"
      ? "Medium yazıları kontrol ediliyor…"
      : job.status === "completed"
        ? "Tarama tamamlandı"
        : "Tarama tamamlanamadı";

  const free = job.free ?? [];
  elements.results.replaceChildren(...free.map(resultCard));

  if (job.status === "running" || free.length > 0) {
    elements.summary.hidden = false;
    elements.summary.replaceChildren();

    const headline = document.createElement("strong");
    headline.textContent =
      job.status === "running"
        ? `${free.length} ücretsiz yazı bulundu`
        : `${free.length} ücretsiz yazı`;

    const detail = document.createElement("span");
    const unknown = job.unknownCount ?? 0;
    detail.textContent = unknown > 0 ? `${unknown} yazı kontrol edilemedi` : `${total} yazı incelendi`;
    elements.summary.append(headline, detail);
  } else {
    elements.summary.hidden = true;
  }

  if (job.status === "completed" && free.length === 0) {
    showError(
      "Ücretsiz yazı bulunamadı",
      `${total} Medium yazısı incelendi; açık veya Friend Link paylaşılmış bir yazı bulunamadı.`,
      true
    );
  } else if (job.status === "error") {
    showError(
      "Tarama tamamlanamadı",
      "Beklenmeyen bir hata oluştu. Açık e-postayı değiştirmeden yeniden deneyebilirsin.",
      true
    );
  } else {
    elements.retryButton.hidden = job.status !== "completed";
  }
}

async function readActiveDigest() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("active_tab_missing");
  }

  const injection = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractVisibleLinksFromActivePage
  });

  return injection?.[0]?.result;
}

async function startAnalysis() {
  elements.emptyState.hidden = true;
  elements.retryButton.hidden = true;
  elements.statusPanel.hidden = false;
  elements.statusText.textContent = "Açık e-posta okunuyor…";
  elements.progressText.textContent = "";
  elements.progressBar.style.width = "8%";

  let extracted;
  try {
    extracted = await readActiveDigest();
  } catch {
    showError(
      "Gmail e-postası okunamadı",
      "Medium Daily Digest e-postasını Gmail’de açıp BetterMedium simgesine tekrar bas.",
      false
    );
    return;
  }

  if (!extracted?.ok) {
    showError(
      "Önce Gmail’i aç",
      "BetterMedium yalnızca açık Gmail sekmesindeki Medium Daily Digest’i analiz eder.",
      false
    );
    return;
  }

  currentCandidates = collectArticleCandidates(extracted.links);
  currentFingerprint = fingerprintCandidates(currentCandidates);

  if (currentCandidates.length === 0) {
    showError(
      "Medium yazısı bulunamadı",
      "Bir Medium Daily Digest e-postasını tamamen açtığından emin ol ve tekrar dene.",
      true
    );
    return;
  }

  const existing = await browser.runtime.sendMessage({ type: "GET_ANALYSIS_STATE" });
  if (
    existing &&
    existing.fingerprint === currentFingerprint &&
    ["running", "completed"].includes(existing.status)
  ) {
    renderJob(existing);
    return;
  }

  browser.runtime
    .sendMessage({
      type: "START_ANALYSIS",
      candidates: currentCandidates,
      fingerprint: currentFingerprint
    })
    .then(renderJob)
    .catch(() => {
      showError(
        "Tarama başlatılamadı",
        "Eklentinin arka plan işlemi yanıt vermedi. Popup’ı kapatıp yeniden aç.",
        true
      );
    });
}

elements.retryButton.addEventListener("click", () => {
  if (!currentCandidates.length || !currentFingerprint) {
    void startAnalysis();
    return;
  }

  elements.retryButton.hidden = true;
  browser.runtime
    .sendMessage({
      type: "START_ANALYSIS",
      candidates: currentCandidates,
      fingerprint: currentFingerprint
    })
    .then(renderJob)
    .catch(() => {
      showError("Tarama başlatılamadı", "Lütfen popup’ı kapatıp yeniden aç.", true);
    });
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "session" && changes.analysisJob?.newValue) {
    renderJob(changes.analysisJob.newValue);
  }
});

void startAnalysis();
