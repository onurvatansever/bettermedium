(() => {
  const SCAN_DELAY_MS = 700;
  const STORY_PATH_PATTERN = /(?:^|\/)[^/?#]*[0-9a-f]{12}\/?$/i;
  let lastFingerprint = "";
  let scanTimer = null;

  function isVisible(element) {
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0 ||
      element.closest('[aria-hidden="true"]')
    ) {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function readMediumStoryLink(anchor) {
    try {
      const url = new URL(anchor.href);
      const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      const isMedium =
        hostname === "medium.com" || hostname.endsWith(".medium.com");

      if (
        url.protocol !== "https:" ||
        !isMedium ||
        !STORY_PATH_PATTERN.test(url.pathname)
      ) {
        return null;
      }

      return {
        href: url.href,
        text:
          anchor.innerText ||
          anchor.textContent ||
          anchor.getAttribute("aria-label") ||
          anchor.querySelector("img[alt]")?.getAttribute("alt") ||
          ""
      };
    } catch {
      return null;
    }
  }

  function collectVisibleMediumLinks() {
    return [...document.querySelectorAll("a[href]")]
      .filter(isVisible)
      .map(readMediumStoryLink)
      .filter(Boolean);
  }

  async function scanOpenEmail() {
    scanTimer = null;
    const links = collectVisibleMediumLinks();
    if (links.length === 0) {
      lastFingerprint = "";
      return;
    }

    const fingerprint = links
      .map(({ href }) => href)
      .sort()
      .join("|");
    if (fingerprint === lastFingerprint) {
      return;
    }

    lastFingerprint = fingerprint;
    try {
      await browser.runtime.sendMessage({
        type: "ANALYZE_GMAIL_DIGEST",
        links
      });
    } catch {
      lastFingerprint = "";
    }
  }

  function scheduleScan() {
    if (scanTimer !== null) {
      clearTimeout(scanTimer);
    }
    scanTimer = setTimeout(scanOpenEmail, SCAN_DELAY_MS);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  scheduleScan();
})();
