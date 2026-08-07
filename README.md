<h2 align="right">
  <a href="./README.md" title="English" aria-label="English">🇬🇧</a>
  <a href="./README.tr.md" title="Türkçe" aria-label="Türkçe">🇹🇷</a>
</h2>

# BetterMedium

A Firefox extension that finds freely accessible stories in your Medium email
digests. It shows public stories and author-shared Friend Links in one place.

[Install BetterMedium from Firefox Add-ons →](https://addons.mozilla.org/en-US/firefox/addon/bettermedium/)

BetterMedium does **not** bypass Medium’s paywall.

## Use

1. [Install BetterMedium from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/bettermedium/).
2. Open a Medium Daily Digest in Gmail; analysis starts automatically.
3. Click the BetterMedium toolbar icon to view the results.

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
the open Gmail page but extracts only Medium story links. When a Medium story
redirects to an independent publication, Firefox may ask for access to that
domain the first time. The permission is limited to that site and remembered by
Firefox; a different publication may require its own permission. Requests send
no cookies, and only session progress and results are stored. Ambiguous or
blocked pages are never presented as free.
