<p align="right">
  <a href="./README.md" title="English" aria-label="English">🇬🇧</a>
  <a href="./README.tr.md" title="Türkçe" aria-label="Türkçe">🇹🇷</a>
</p>

# BetterMedium

Açtığın Gmail özetindeki herkese açık Medium yazılarını ve yazarların paylaştığı
Friend Link'leri bulan, Zen Browser ile uyumlu bir Firefox WebExtension.

BetterMedium, Medium'un ödeme duvarını **aşmaz**.

## Kullanım

1. `about:debugging#/runtime/this-firefox` adresini aç.
2. **Geçici eklenti yükle** seçeneğine bas.
3. `extension/manifest.json` dosyasını seç.
4. Gmail'de bir Medium Daily Digest aç; analiz otomatik başlar.
5. Sonuçları görmek için araç çubuğundaki BetterMedium ikonuna bas.

Geçici kurulum tarayıcı yeniden başlatıldığında silinir. Kalıcı kurulum için
Mozilla tarafından imzalanmış bir `.xpi` gerekir.

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
bir yazıyı bağımsız yayın domainine yönlendirirse Firefox sadece o domain için
izin sorar. İsteklerde çerez gönderilmez; yalnızca oturum ilerlemesi ve sonuçlar
saklanır. Belirsiz veya engellenmiş sayfalar ücretsiz gösterilmez.
