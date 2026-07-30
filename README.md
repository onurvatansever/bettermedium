# BetterMedium

BetterMedium is a privacy-first Firefox and Zen Browser extension that scans the
Medium Daily Digest currently open in Gmail. It shows only stories that are
already public or have an author-shared Medium Friend Link.

It does **not** bypass Medium's paywall. It only surfaces access that Medium and
the story author already made available.

## How it works

1. Open a Medium Daily Digest in Gmail.
2. Click the BetterMedium toolbar icon.
3. The popup extracts visible Medium story links from that tab.
4. Up to four stories are checked in parallel.
5. Public stories and valid Friend Links appear in the popup.

The extension has no backend, account, telemetry, or paid service. It receives
temporary access to the active Gmail tab only after you click it. Article URLs
and results are retained in Firefox session storage so reopening the popup does
not lose the current analysis. Raw email and article HTML are never stored.

## Permissions

- `activeTab`: temporarily read the Gmail tab you explicitly selected.
- `scripting`: extract visible links from that active tab.
- `storage`: preserve progress/results for the current browser session.
- `https://medium.com/*` and `https://*.medium.com/*`: fetch Medium story pages
  without sending Medium cookies.

## Run in Zen Browser or Firefox

Development installation is temporary and disappears after restarting the
browser:

1. Clone or download this repository.
2. Open `about:debugging#/runtime/this-firefox` in Zen or Firefox.
3. Select **Load Temporary Add-on**.
4. Choose `extension/manifest.json`.
5. Open a Medium Daily Digest in Gmail and click the BetterMedium icon.

For a permanent installation, Firefox-family browsers require a Mozilla-signed
`.xpi`. Build the source package first, then submit it as a listed or unlisted
extension through the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/).

## Development

Prerequisites:

- Node.js 20 or newer
- npm

```powershell
npm install
npm test
npm run lint:webext
npm run build
```

The build command writes an unsigned package to `web-ext-artifacts/`. Mozilla
signing requires an AMO account and is intentionally separate from the local
build.

To launch an isolated temporary Zen profile from the command line:

```powershell
npx web-ext run --source-dir extension --firefox "C:\Program Files\Zen Browser\zen.exe"
```

`web-ext run` stays active while the temporary browser is open. Closing that
browser ends the development session.

## Manual acceptance check

Before publishing a release:

1. Load the extension temporarily in Zen.
2. Open a real Medium Daily Digest in Gmail.
3. Confirm the popup reports 15 stories for the anonymized test digest.
4. Close and reopen the popup during analysis; progress must be preserved.
5. Check one known public story, one member-only story, and one Friend Link.
6. Confirm every **Oku** button opens the expected Medium story in a new tab.
7. Open the popup outside Gmail and confirm it shows a safe explanatory error.

## Classification policy

BetterMedium is deliberately conservative:

- A valid `sk` parameter in the digest is accepted as a Friend Link.
- An accessible story page is searched for a same-story `sk` link.
- A redirect is accepted only when it stays on Medium and preserves the story
  ID.
- A valid story page without a member-only signal is treated as public.
- Invalid pages, timeouts, redirects that cannot be inspected, and ambiguous
  responses are reported as "could not be checked", never as free.

Medium and Gmail do not expose stable public DOM contracts for this workflow.
Changes to either site may require updates to the extraction/classification
rules. Medium may also return a browser or Cloudflare challenge; BetterMedium
treats that response as unverified instead of guessing.

## Distribution

The first release targets desktop Zen Browser and Firefox only. Chrome, mobile
browsers, Gmail automation, scheduled execution, `.eml` upload, and a hosted
backend are intentionally out of scope.
