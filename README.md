<h2 align="right">
  <a href="./README.md" title="English" aria-label="English">🇬🇧</a>
  <a href="./README.tr.md" title="Türkçe" aria-label="Türkçe">🇹🇷</a>
</h2>

# BetterMedium

A Firefox extension that finds freely accessible stories in your Medium email
digests. It shows public stories and author-shared Friend Links in one place.

BetterMedium does **not** bypass Medium’s paywall.

## Use

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `extension/manifest.json`.
4. Open a Medium Daily Digest in Gmail; analysis starts automatically.
5. Click the BetterMedium toolbar icon to view the results.

Temporary installations are removed when the browser restarts. A permanent
installation requires a Mozilla-signed `.xpi`.

## Development

Requires Node.js 20+ and npm.

```powershell
npm install
npm test
npm run lint:webext
npm run build
```

## Privacy

There is no backend, account, telemetry, or paid service. BetterMedium can read
the open Gmail page but extracts only Medium story links. If Medium redirects a
story to an independent publication, Firefox asks only for that publication's
domain. Requests send no cookies, and only session progress and results are
stored. Ambiguous or blocked pages are never presented as free.
