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

Cloudflare API anahtarını yalnızca ortam değişkeninde kullanın. Kaynak koduna veya GitHub'a eklemeyin. `wrangler.jsonc`, mevcut Cloudflare Pages projesi için yapılandırılmıştır.

## Saklama ve gizlilik

D1, sunucu, hesap veya bulut kitap depolaması yoktur. PDF dosyaları, notlar ve okuma ilerlemesi cihazdaki IndexedDB içinde tutulur. PDF verileri ile ilerleme ayrı depolarda saklanır; sayfa değişimlerinde kitabın tamamı tekrar yazılmaz. Yalnızca görüntülenen sayfa işlenir. PDF dosyaları sunucuya gönderilmez. Google Fonts yazı tipleri için harici bağlantı kullanılır.

Veriler cihaz ve tarayıcıya özeldir. Tarayıcı site verilerini temizlemek kitapları ve notları siler. Cihazlar arası eşitleme ve yedekleme yoktur; orijinal PDF dosyalarınızı saklayın. Gizli tarayıcı oturumunda veriler kalıcı olmayabilir. Şifreli PDF desteklenmez; dosya başına en fazla 150 MB kabul edilir.

## Doğrulama

Üç sayfalık örnek PDF ile ekleme, görüntüleme, sayfa geçişi, yeniden yükleme sonrasında ilerleme/not/ayraç kalıcılığı ve 390px mobil taşma kontrolü. Üretim derlemesi ve npm bağımlılık denetimi.


## Orijinal PDF görüntüsü ve kelime açıklamaları

JPEG 2000 ve JBIG2 gibi taranmış PDF görüntüleri için PDF.js WASM, CMap ve standart font dosyaları build sırasında `public/pdfjs/` içine kopyalanır. Bu dosyaların dağıtıma eklenmemesi, bazı kitaplarda yalnızca metin katmanının görünmesine neden olur. Kaydedilen PDF baytları değiştirilmez; gece modu PDF renklerine filtre uygulamaz. Eski kapak önizlemeleri ilk sayfadan otomatik yenilenir. İstenirse açık sayfa kapak yapılabilir ve orijinal PDF indirilebilir.

Şeffaf metin katmanı üzerinden kelimeye dokununca okunaklı yazılışı ve Türkçe Vikisözlük açıklaması gösterilir. Yalnızca sorgulanan kelime Vikisözlük API'sine gider; PDF dosyası veya sayfa görüntüsü gönderilmez. PDF'nin mevcut OCR/metin katmanındaki hatalar balonda düzeltilebilir. Metin katmanı olmayan taramalar için otomatik el yazısı tanıma uygulanmaz. İnternet ya da sözlük maddesi yoksa bulunamadı/bağlantı mesajı gösterilir; anlam uydurulmaz.

Tam ekran API'si desteklendiğinde `navigationUI: hide` istenir. Desteklemeyen mobil tarayıcılarda site tarayıcı çubuklarını zorla kaldıramaz; ana ekrana ekleme yönergesi ve fullscreen/standalone web uygulaması manifesti sunulur. Uygulama modunda tarayıcı depolaması ayrı olabileceğinden kitap yeniden eklenebilir. Cihaz üzerinde uygulama kurulum testi yapılmadı.

Gerçek 294 sayfalık kullanıcı PDF'siyle renkli kapak, taranmış iç sayfa, kelime ve canlı sözlük sonucu, tam ekranda balon, Esc ile çıkış, mobil düzen ve SHA-256 dosya eşitliği kontrol edildi. Kullanıcının PDF'si depoya veya yayın dosyalarına eklenmedi.
