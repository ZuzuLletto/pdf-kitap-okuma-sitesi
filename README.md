# Sayfa — PDF kitaplığı

Sıcak kâğıt tonlarında, mobil uyumlu kişisel PDF okuyucu. PDF ekleme, kapak önizlemesi, toplam sayfa, otomatik okuma ilerlemesi, ayraçlar, sayfa notları, gece modu, yakınlaştırma ve tam ekran içerir.

## Çalıştırma

```sh
npm ci
npm run dev
npm run build
```

## Cloudflare Pages

Mevcut proje: `pdf-kitap-okuma-sitesi`. Build komutu `npm run build`, çıktı dizini `dist`.

```sh
npx wrangler pages deploy dist --project-name pdf-kitap-okuma-sitesi --branch main
```

Cloudflare API anahtarını yalnızca ortam değişkeninde kullanın. Kaynak koduna veya GitHub'a eklemeyin. `wrangler.jsonc`, isteğe bağlı Workers statik dağıtımı içindir; mevcut yayın Pages üzerindedir.

## Saklama ve gizlilik

D1, sunucu, hesap veya bulut kitap depolaması yoktur. PDF dosyaları, notlar ve okuma ilerlemesi cihazdaki IndexedDB içinde tutulur. PDF verileri ile ilerleme ayrı depolarda saklanır; sayfa değişimlerinde kitabın tamamı tekrar yazılmaz. Yalnızca görüntülenen sayfa işlenir. PDF dosyaları sunucuya gönderilmez. Google Fonts yazı tipleri için harici bağlantı kullanılır.

Veriler cihaz ve tarayıcıya özeldir. Tarayıcı site verilerini temizlemek kitapları ve notları siler. Cihazlar arası eşitleme ve yedekleme yoktur; orijinal PDF dosyalarınızı saklayın. Gizli tarayıcı oturumunda veriler kalıcı olmayabilir. Şifreli PDF desteklenmez; dosya başına en fazla 150 MB kabul edilir.

## Doğrulama

Üç sayfalık örnek PDF ile ekleme, görüntüleme, sayfa geçişi, yeniden yükleme sonrasında ilerleme/not/ayraç kalıcılığı ve 390px mobil taşma kontrolü. Üretim derlemesi ve npm bağımlılık denetimi.
