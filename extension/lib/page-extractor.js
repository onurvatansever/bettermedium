export function extractVisibleLinksFromActivePage() {
  if (location.hostname !== "mail.google.com") {
    return {
      ok: false,
      code: "not_gmail",
      links: []
    };
  }

  const isVisible = (element) => {
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
  };

  const links = [...document.querySelectorAll("a[href]")]
    .filter(isVisible)
    .map((anchor) => ({
      href: anchor.href,
      text:
        anchor.innerText ||
        anchor.getAttribute("aria-label") ||
        anchor.querySelector("img[alt]")?.getAttribute("alt") ||
        ""
    }));

  return {
    ok: true,
    code: "ok",
    links,
    pageTitle: document.title
  };
}
