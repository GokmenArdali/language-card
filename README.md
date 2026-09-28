# Dil Kartları

Türkçe → İngilizce üretim odaklı, internetsiz çalışan kişisel aralıklı tekrar (FSRS) uygulaması.
iPhone'da ana ekrana eklenerek kullanılır; veriler yalnızca cihazda (IndexedDB) tutulur.

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # birim testleri
npm run build      # dist/ klasörüne üretim çıktısı
npm run preview    # üretim çıktısını (service worker dahil) yerelde dene
```

## Yayınlama — GitHub Pages (önerilen)

`main` dalına her gönderimde `.github/workflows/deploy.yml` testleri çalıştırır, derler ve yayınlar.

1. GitHub'da **boş** bir depo oluştur (ör. `language-card`). README vb. ekleme.
2. Bu klasörde:
   ```bash
   git remote add origin https://github.com/<kullanici-adin>/language-card.git
   git push -u origin main
   ```
3. Depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** seç.
4. **Actions** sekmesinde iş bitince adres: `https://<kullanici-adin>.github.io/language-card/`

Depo herkese açık olursa kodun görünür; kartların **görünmez** (onlar yalnızca telefonunda).

### Alternatif — Netlify

- Hızlı yol: `npm run build`, sonra `dist` klasörünü <https://app.netlify.com/drop> sayfasına sürükle.
- Otomatik yol: GitHub deposunu Netlify'a bağla; `netlify.toml` ayarları hazır.

## iPhone'a ekleme

1. Yayın adresini **Safari**'de aç (Chrome vb. ana ekrana PWA olarak eklemez).
2. Paylaş düğmesi → **Ana Ekrana Ekle** → Ekle.
3. Uygulamayı ana ekrandaki **Kartlar** simgesinden bir kez açıp birkaç saniye bekle: tüm dosyalar önbelleğe alınır, bundan sonra internetsiz çalışır.
4. İsteğe bağlı: Ayarlar → Seslendirme → **Dene** ile sesi kontrol et. Daha doğal ses için iPhone'da
   *Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler → İngilizce* altından "Gelişmiş" bir ses indirip uygulamada seçebilirsin.

### Önemli

- Ana ekran uygulaması ile Safari sekmesinin verileri **ayrıdır**; kartları hep ana ekrandaki uygulamada gir.
- Uygulamayı ana ekrandan silmek verileri de siler. **Ayarlar → Yedeği dışa aktar** ile düzenli yedek al
  (paylaşım menüsünde “Dosyalar’a Kaydet”). 7 günü geçince ana sayfa uyarır.
- Yeni sürüm yayınladığında uygulama bir sonraki açılışta kendini günceller.

## CSV ile toplu kart

Sütunlar `front,back,hint,source` (başlık satırı isteğe bağlı; virgül veya noktalı virgül).
Türkçe başlıklar da tanınır: `Türkçe;İngilizce;İpucu;Kaynak`. Aynı Türkçe+İngilizce kartlar atlanır.

```csv
front,back,hint,source
Koşmak zorundayım.,I have to run.,run…,Friends S1E3
"Bunu sen yapmadın, değil mi?","You didn't do this, did you?",,Friends S1E4
```

## Kurallar

- Algoritma: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) varsayılanları (hedef hatırlama %90, 1dk/10dk öğrenme adımları).
- Gün 04:00'te başlar. Önce bekleyen tekrarlar, sonra günlük limit kadar yeni kart gelir.
- Bir kart toplam 4 kez “Tekrar” alırsa sorunlu işaretlenir; düzenleyip kaydedince işaret kalkar.
- Çalışma ekranında yanlış basışı üstteki ↶ ile geri alabilirsin.
