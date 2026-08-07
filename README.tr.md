<h2 align="right">
  <a href="./README.md" title="English" aria-label="English">🇬🇧</a>
  <a href="./README.tr.md" title="Türkçe" aria-label="Türkçe">🇹🇷</a>
</h2>

# BetterMedium

Medium e-posta özetlerindeki ücretsiz okunabilen yazıları bulan bir Firefox
eklentisi. Herkese açık yazıları ve yazarların paylaştığı Friend Link’leri tek
yerde gösterir.

[BetterMedium'u Firefox Add-ons üzerinden yükle →](https://addons.mozilla.org/en-US/firefox/addon/bettermedium/)

BetterMedium, Medium’un ödeme duvarını **aşmaz**.

## Kullanım

1. [BetterMedium'u Firefox Add-ons üzerinden yükle](https://addons.mozilla.org/en-US/firefox/addon/bettermedium/).
2. Gmail'de bir Medium Daily Digest aç; analiz otomatik başlar.
3. Sonuçları görmek için araç çubuğundaki BetterMedium ikonuna bas.

## Geliştirme

Node.js 20+ ve npm gerekir.

```powershell
npm install
npm test
npm run lint:webext
npm run build
```

## Gizlilik

Backend, hesap, telemetri veya ücretli servis yoktur. BetterMedium açık Gmail
sayfasını okuyabilir ancak yalnızca Medium makale bağlantılarını çıkarır. Medium
yazısı bağımsız bir yayın domainine yönlenirse Firefox bu domain için ilk kez
izin isteyebilir. İzin yalnızca ilgili siteyle sınırlıdır ve Firefox tarafından
hatırlanır; farklı bir yayın sitesi yeni izin gerektirebilir. İsteklerde çerez
gönderilmez; yalnızca oturum ilerlemesi ve sonuçlar saklanır. Belirsiz veya
engellenmiş sayfalar ücretsiz gösterilmez.
