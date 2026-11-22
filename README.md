# Akıl Oyunları Koçu

Kendi oyunlarından öğrenmek için kişisel bir akıl oyunları çalışma uygulaması. Puan ya da sıralama yok; amaç daha iyi oynamak.

Şu an beş oyun var: **Satranç**, **Mangala**, **Go**, **Dama** ve **Reversi**. Ana ekranın üstündeki sekmelerden oyun seçilir; her oyunun aynı dört bölümü vardır:

- **Dersler:** Temel bilgileri bir kurs gibi adım adım öğreten kısa dersler: kısa açıklamalar ve tahtada "sıra sende" alıştırmaları.

- **Oyna:** Bilgisayara karşı, 8 zorluk seviyesinde. Koç modu her hamleden önce kısa bir hatırlatma gösterir ve bir şey kaptıracak bir hamle yaparsan seni uyarıp geri almana izin verir.
- **Analiz:** Chess.com'un oyun incelemesi gibi: senin ve rakibinin **her hamlesine** bir etiket (Parlak, Harika, En iyi, Çok iyi, İyi, Zorunlu, Yanlışlık, Hata, Büyük hata) ve kısa, sade Türkçe bir açıklama verir.
- **Bulmaca:** Kendi hatalarından oluşan bulmacalar, aralıklı tekrarla (1, 3, 7, 14, 30 gün) yeniden karşına çıkar.

Her şey bilgisayarında çalışır. Hesap, API anahtarı ya da ücretli bir servis gerekmez. İstersen **bilgisayarına uygulama olarak kurabilirsin**: masaüstünde simgesi olur, kendi penceresinde açılır ve internetsiz de çalışır (bkz. "Uygulama olarak kurmak").

### Öğrenme modu ve oynama modu
Her oyundan önce **"Nasıl oynamak istersin?"** diye sorulur (son seçimin işaretli gelir):
- **🎓 Öğrenme modu:** Bir kurs gibi. Koç her hamlede şunları yapar:
  - **Koçun notu:** Her hamleden önce büyük harflerle tek, kısa bir not çıkar. Örnekler: "Bir taşın tehlikede. Önce onu kurtar ya da koru.", "Alabileceğin bir köşe var. Bulabilir misin?" Koç **hangi hamleyi oynaman gerektiğini asla söylemez**; neye bakman gerektiğini söyler. Rakip hata yaptıysa "Rakip hata yaptı! Bunu cezalandıracak hamleyi bul." der.
  - **Hamle analizi:** Notun altında son hamlen ve bilgisayarın cevabı, analiz ekranındaki etiketlerle (En iyi, Çok iyi, Hata…) ve kısa bir açıklamayla görünür.
  - **Üstünlük çubuğu:** Tahtanın solundaki dikey çubuk kimin önde olduğunu gösterir. Alttaki senin rengin; yüzde senin kazanma şansın.
  - **Uyarı ve geri alma:** Bir şey kaptıracak bir hamle yaparsan koç seni uyarır ve **"Hamlemi geri al"** seçeneği sunar.

  Bu yardımları "Koç ayarları"ndan ayrı ayrı kapatabilirsin. Koç kendi motorunu kullanır, bilgisayarın hamlelerini yavaşlatmaz.
- **♟ Oynama modu:** Hiç yardım yok, gerçek bir oyun gibi.

İki modda da oyun kaydedilir, analiz edilir ve bulmacalar üretilir. Her oyun için hangi modda oynandığı ve öğrenme modunda koçun kaç kez uyardığı / kaç kez geri aldığın saklanır; analiz ekranında ve oyun listesinde görünür. Ana ekrandaki büyük hata ortalaması, iki modda da oyunun varsa **yardımsız oyunlar** (oynama modu ve dışarıdan eklenen oyunlar) ile **öğrenme modu** için ayrı ayrı da gösterilir. Bir oyunun modu başladıktan sonra değişmez.

---

## 1. Gerekenler

- **Node.js 20 veya daha yeni** (https://nodejs.org adresinden "LTS" sürümünü indir).
  Kurulu olup olmadığını görmek için bir terminal açıp şunu yaz:

  ```bash
  node -v
  ```

  `v20.x.x` ya da daha büyük bir sayı görmelisin.

## 2. Kurulum (bir kez)

Terminalde proje klasörüne gir ve bağımlılıkları kur:

```bash
npm install
```

Bu komut kütüphaneleri indirir ve Stockfish (satranç motoru) dosyalarını otomatik olarak `public/stockfish/` klasörüne kopyalar.
Sonunda "Stockfish motoru public/stockfish/ klasörüne kopyalandı." yazısını görmelisin. Mangala, Go, Dama ve Reversi motorları uygulamanın içindedir, ayrıca bir şey gerekmez.

## 3. Çalıştırma

```bash
npm run dev
```

Terminalde çıkan adresi tarayıcıda aç: **http://localhost:5173**

Durdurmak için terminalde `Ctrl + C`.

### Telefonda kullanmak

1. Bilgisayar ve telefon aynı Wi-Fi ağında olsun.
2. `npm run dev` çalışırken terminalde `Network:` ile başlayan satırdaki adresi bul (örneğin `http://192.168.1.20:5173`).
3. Bu adresi telefonun tarayıcısına yaz.

> Telefondaki veriler telefonun tarayıcısında, bilgisayardakiler bilgisayarınkinde ayrı ayrı saklanır.

## En kolay yol: çift tıkla

Proje klasöründeki **Uygulamayı Başlat.cmd** dosyasına çift tıkla. Başlatıcı:
- İlk açılışta gerekli kütüphaneleri kurar (bir kez, internet gerekir).
- Kod değiştiyse uygulamayı yeniden hazırlar.
- Uygulamayı **http://localhost:4173** adresinde başlatır ve Edge'de adres çubuğu olmayan kendi penceresinde açar.

Açılan siyah pencere açık kaldığı sürece uygulama çalışır ve güncel kalır; kapatmak için o pencereyi kapat. Uygulama zaten çalışıyorsa başlatıcı yalnızca pencereyi açar. Kısayolunu masaüstüne koymak için dosyaya sağ tıkla → **Kısayol oluştur**, oluşan kısayolu masaüstüne sürükle. Terminalden aynı işi `npm.cmd start` yapar.

## Uygulama olarak kurmak (önerilen)

Uygulamayı Edge ya da Chrome ile bilgisayarına kurabilirsin. Kurduktan sonra Başlat menüsünde ve masaüstünde simgesi olur, tarayıcı çubukları olmadan kendi penceresinde açılır ve **sunucu çalışmıyorken, internet yokken de açılır**.

1. Proje klasöründe şu komutu çalıştır. Uygulamayı hazırlar ve tarayıcında **http://localhost:4173** adresini açar:

   ```powershell
   npm.cmd run app
   ```

2. Adres çubuğunun sağındaki **"Uygulamayı yükle"** simgesine (ekran ve aşağı ok) tıkla. Simgeyi göremezsen: Edge'de **⋯ → Uygulamalar → Bu siteyi uygulama olarak yükle**, Chrome'da **⋮ → Yayınla, kaydet ve paylaş → Sayfayı uygulama olarak yükle**.
3. "Yükle" de. Uygulama kendi penceresinde açılır. Artık terminali `Ctrl + C` ile kapatabilirsin.

Ana ekranın altındaki **"Uygulama olarak kur"** kartı da aynı işi yapar: tarayıcı izin veriyorsa **Uygulamayı kur** düğmesi çıkar. Kart, uygulamayı kurduktan sonra kendi penceresinde görünmez.

Bundan sonra uygulamayı masaüstündeki ya da Başlat menüsündeki **Akıl Oyunları Koçu** simgesinden aç.

**Güncellemek:** Kodda değişiklik olduğunda `npm.cmd run app` komutunu bir kez daha çalıştır ve uygulamayı aç. Yeni sürüm kendiliğinden alınır; bir sonraki açılışta görünür. Kayıtların silinmez.

**Kayıtlarını taşımak:** Uygulama verilerini kendi içinde saklar. Bu veriler tarayıcıda (`localhost:5173`) oynadığın oyunlardan ayrıdır. Eski oyunlarını uygulamaya almak için tarayıcıdaki ana ekranın en altında **Yedekle**'ye bas, sonra uygulamanın ana ekranında **Yedeği yükle** ile indirilen `akil-oyunlari-yedek-….json` dosyasını seç. Yedek yüklemek hiçbir şeyi silmez; aynı oyun iki kez eklenmez.

> PowerShell'de `npm` yazınca "running scripts is disabled" hatası alırsan, `npm` yerine `npm.cmd` yaz. Bu, aynı programın betik olmayan hâlidir; bilgisayarının güvenlik ayarını değiştirmen gerekmez.

## 4. Testler

```bash
npm test
```

Kurallar (satranç, Mangala, Go, Dama ve Reversi), hamle sınıflandırması, taş bırakma, taş kaptırma ve atari tespitleri, açıklamalar, koç uyarıları, Mangala, Go, Dama ve Reversi motorları, Go sayımı ve SGF okuma/yazma, aralıklı tekrar, cevap kontrolü, Chess.com içe aktarma, eski verilerin taşınması ve ilerleme özeti için birim testleri çalışır. Go, Dama ve Reversi testlerinin bir kısmı gerçek motorla bütün analizi baştan sona çalıştırır.

## 5. Kalıcı bir sürüm oluşturmak (isteğe bağlı)

```bash
npm run build
npm run preview
```

`build` komutu `dist/` klasörüne hazır bir site üretir. Bu klasör herhangi bir statik barındırmaya (GitHub Pages, Netlify, Cloudflare Pages vb.) olduğu gibi yüklenebilir; özel sunucu ayarı gerekmez.

> `dist/index.html` dosyasına çift tıklayarak açmak **çalışmaz**: tarayıcılar motorların (Web Worker) dosyadan yüklenmesine izin vermez. `npm run preview` ya da bir barındırma kullan.

---

## Satranç

### Oyna
1. Zorluk seç. 1-3 arası seviyeler bilerek hata yapar; **3 (Kolay+)** 700 civarı için iyi bir başlangıç.
2. Rengini seç (Beyaz / Siyah / Rastgele).
3. **Öğrenme modu** ya da **oynama modu** seç. Öğrenme modunda hatırlatmaları ve taş bırakma uyarısını ayrı ayrı açıp kapatabilirsin (oyun sırasında da "Koç ayarları"ndan).
4. Taşları sürükleyerek ya da önce taşa, sonra gideceği kareye tıklayarak oyna.
5. Oyun bitince **Bu oyunu analiz et** butonuna bas; analiz kendiliğinden başlar.

### Analiz
- **PGN yapıştır:** Chess.com'da oyunu aç → Paylaş → PGN → Kopyala, buraya yapıştır.
- **Chess.com:** Kullanıcı adını yaz, son oyunların listelensin, birini seç.
  Chess.com'a bağlanılamazsa (internet ya da tarayıcı kısıtlaması) PGN yapıştırma yöntemini kullan.
- **Sonraki hata** butonu seni doğrudan hatalarına götürür. Kırmızı ok senin hamleni, yeşil ok daha iyisini gösterir.
- Açıklamalar şunları tanır: korumasız taş, korumayı kaldırma, gözden kaçan saldırı, çatal, bedava taş, mat tehdidi, kaçırılan mat.

### Bulmaca
Yanlış cevapta ipucu olarak hangi taşla oynaman gerektiği (yeşil çerçeveli kare) gösterilir.

---

## Mangala

### Kurallar (uygulamanın kullandığı)
- 2 × 6 kuyu, her kuyuda 4 taş (toplam 48); iki tarafta birer hazine.
- Kendi kuyundaki bütün taşları alırsın; **ilk taşı aldığın kuyuya** bırakır, kalanları saat yönünün tersine birer birer dağıtırsın. **Kuyuda tek taş varsa** o taş bir sonraki kuyuya geçer.
- Kendi hazinene taş bırakılır, rakibin hazinesi atlanır.
- **Son taş kendi hazinene düşerse** bir kez daha oynarsın.
- **Çift kuralı:** Son taş rakibin bir kuyusundaki taş sayısını çift yaparsa o kuyudaki bütün taşları alırsın.
- **Boş kuyu kuralı:** Son taş kendi boş kuyuna düşer ve karşısında rakibin taşı varsa, hem o taşları hem kendi taşını alırsın. Karşı kuyu boşsa taş yerinde kalır.
- **Oyun sonu:** Bir oyuncunun kuyuları boşalınca oyun biter; kuyuları önce boşalan oyuncu rakibinin kuyularındaki bütün taşları alır. En çok taşı olan kazanır, 24-24 berabere.

### Oyna
1. Zorluk seç. 1. seviye çoğu zaman rastgele oynar (kuralları öğrenmek için); 3-4 iyi bir başlangıç, 8 tam güçtür.
2. **Kim başlasın?** Ben başlayayım / Bilgisayar başlasın / Rastgele.
3. Oynamak için kendi kuyuna (alttaki sıra) tıkla. Dağıtım taş taş gösterilir; yakalanan taşlar son taş düşünce hazineye gider.
4. Kuyu numaraları sahibinin bakış açısındandır: senin kuyuların soldan sağa 1-6. Hamleler "4. kuyu (tekrar)", "6. kuyu (+4 taş)" gibi yazılır.

**Öğrenme modunda** koç her hamleden önce o anki pozisyona göre iki soru sorar (cevabı söylemeden): kuyularından biri tehlikede mi, taş alabileceğin ya da tekrar oynayabileceğin bir hamle var mı? **Taş kaptırma uyarısı**, rakibe bir sonraki sırasında 3 ya da daha fazla taş kazandıracak bir hamle yaptığında (ve daha güvenli bir hamle varsa) çıkar; tehlikedeki kuyu kırmızıyla gösterilir ve "Hamlemi geri al" diyebilirsin. Tekrar oynama hakkı veren hamlelerde uyarı çıkmaz, çünkü sıra hâlâ sendedir.

### Analiz
Mangala oyunları uygulamada oynadığın oyunlardır (Chess.com benzeri açık bir kaynak yok). Açıklamalar şunları tanır:
- rakibe çift ya da boş kuyu kuralıyla taş kaptırma (tekrar oynayarak yapılan yakalamalar dahil),
- kaçırılan yakalama ve kaçırılan tekrar oynama fırsatı,
- rakibe art arda oynama fırsatı verme,
- rakibin kuyularını boşaltıp senin taşlarını alması, oyunu kaybettiren ya da zorla kazanılabilecekken kaçırılan oyun sonu,
- "Taş aldın ama…" / "Tekrar oynama hakkı kazandın ama…" gibi iyi görünen ama kötü olan hamleler.

### Bulmaca
Sadece 6 kuyu olduğu için ipucu doğru kuyuyu göstermez, **fikri** söyler: "Son taşın hazinene düşeceği kuyuyu bul", "Rakibin bir kuyusunu çift yapabilir misin?", "Son taşını kendi boş kuyuna düşür" ya da tehlikedeki kuyunu kırmızıyla işaretler. Fikir yoksa doğru kuyunun hangi yarıda (1-3 / 4-6) olduğunu söyler.

## Go

### Kurallar (uygulamanın kullandığı)
- **9 × 9** tahta. Siyah başlar; sırayla çizgilerin kesiştiği boş noktalara taş konur, taşlar yer değiştirmez.
- Bir taşın hemen yanındaki (sağ, sol, üst, alt) boş noktalar onun **nefesidir**. Yan yana duran aynı renk taşlar bir grup olur ve nefeslerini paylaşır. Tek nefesi kalan gruba **atari** denir.
- Bir grubun bütün nefeslerini kapatan, o taşları yakalayıp tahtadan alır.
- **İntihar yasak:** Rakibi yakalamıyorsan taşını nefessiz bırakacağın yere oynayamazsın.
- **Ko:** Az önce tek taş yakalayan taşı hemen geri yakalamak yasaktır; önce başka bir yere oynanır.
- **Sayım (Çin usulü alan sayımı):** Tahtadaki canlı taşlar ve çevirdiğin boş noktalar sayılır. Beyaz ikinci başladığı için **7,5 komi** alır (bu yüzden berabere olamaz).
- İki oyuncu üst üste **pas geçince** oyun biter.

### Oyna
1. Başlamadan önce kısa bir **"Go nasıl oynanır?"** kartı görünür (yarım kalmış bir oyunun varsa kapalı gelir; dokunarak açabilirsin).
2. Zorluk seç. 1-4 arası seviyeler bilerek hata yapar (1 en çok); **2 (Kolay)** yeni başlayanlar için iyi bir başlangıç, 8 (Usta) en güçlüsüdür.
3. Rengini seç: **Siyah (ilk sen başla)** / Beyaz / Rastgele.
4. Taş koymak için bir kesişim noktasına dokun. Hamleler "D4", "E5 (+2 taş)", "Pas" diye yazılır; koordinatlarda I harfi yoktur (A-H, J).
5. Oynayacak işe yarar yer kalmayınca **Pas geç**e bas (her seferinde onay ister). Bilgisayar da bütün alanlar kapanınca pas geçer.
6. Oyun bitince alanlar küçük karelerle, ölü sayılan taşlar soluk ve ✕ işaretli gösterilir. Ölü taş tahmini yanlışsa **taşa dokunarak** o grubu ölü ya da canlı yap; sonuç ve kayıtlı oyun hemen güncellenir.

**Öğrenme modunda** koç her hamleden önce o anki pozisyona göre üç soru sorar (cevabı söylemeden): tek ya da iki nefesi kalan taşın var mı, rakibin yakalanabilecek ya da sıkıştırılabilecek taşları var mı, bütün alanlar kapandı mı? **Taş kaptırma uyarısı** şu durumlarda çıkar ve "Hamlemi geri al" diyebilirsin:
- Taşlarını **atariye sokan** bir hamle (rakip hemen yakalayabilecekse; ko almak hariç). Tehlikedeki taşlar kırmızı, rakibin oynayacağı nokta turuncu halkayla gösterilir.
- Atarideki 2 ya da daha fazla taşını **kurtarabilecekken** başka yere oynamak.
- Sahibi belli olmayan yerler varken **erken pas** geçmek. Az sayıda kaldıysa bu noktalar yeşil karelerle gösterilir. Rakip pas geçtikten sonra senin pasın oyunu kaybettirecekse bunu da söyler; kazandığın bir oyunu bitirmene karışmaz.

**Alanı göster (öğrenme modunda):** Pas geç düğmesinin yanındaki **Alanı göster** düğmesi, oyunun o anında muhtemel alanları tahtada küçük karelerle işaretler ve tahmini alanı yazar ("Tahmini alan: Siyah 39,5, Beyaz 41,5 + 7,5 komi. Beyaz yaklaşık 9,5 önde."). Tahmin, pozisyondan yüzlerce rastgele oyun oynanıp her noktanın sonunda kime kaldığına bakılarak yapılır; muhtemelen ölecek taşlar çarpıyla gösterilir. Oynama modunda bu yardım yoktur.

### Analiz
- Uygulamada oynadığın oyunlar kendiliğinden listelenir.
- **Oyun ekle:** Başka bir yerde (örneğin OGS'de) oynadığın **9×9** bir oyunun **SGF** dosyasını seç ya da metnini yapıştır. Oyuncu adından rengini anlayamazsa hangi renkle oynadığını sorar. Başka boyuttaki tahtalar şimdilik desteklenmiyor.
- Açıklamalar şunları tanır:
  - taşlarını atariye sokma ("kendi 2 taşını atariye soktu: tek nefesleri D4 kaldı"),
  - atarideki taşlarını kurtarmama ve birkaç hamle içinde taş kaptırma,
  - kaçırılan yakalama (hemen ya da birkaç hamlede),
  - zayıflayan, kurtarılması zorlaşan gruplar ve rakibin taşlarının kurtulmasına izin verme,
  - erken pas,
  - küçük hamleler: oyun başında kenara oynamak, zaten senin olan alanın ya da rakibin sağlam alanının içine oynamak, daha büyük yeri kaçırmak.
- Kaybedilen alan "Yaklaşık 4 alan kaybettirdi" diye yazılır.

### Bulmaca
İpucu önce **fikri** gösterir: yakalanabilecek rakip taşlarını turuncu, kurtarılması gereken taşlarını kırmızı halkayla işaretler ya da atariye sokulabilecek bir grubu gösterir. Böyle bir fikir yoksa doğru hamlenin tahtanın hangi bölgesinde olduğunu ("sol üst köşesinde", "ortasında" gibi) söyler ve o bölgeyi işaretler.

---

## Dama

### Kurallar (uygulamanın kullandığı Türk daması)
- 8 × 8 tahta, her oyuncunun 16 taşı (2. ve 3. sıralarda). Beyaz başlar.
- Taşlar bir kare **ileri ya da yana** gider; geri ve çapraz gitmez.
- **Alma:** Rakip taşın hemen önündeki ya da yanındaki karenin arkası boşsa üstünden atlayıp alırsın. Alabildiğin sürece aynı hamlede almaya devam edersin; alınan taş hemen tahtadan kalkar.
- **Alma zorunludur** ve birden fazla yol varsa **en çok taş alan yol** seçilmelidir. Alman gereken taşlar turuncu halkayla gösterilir.
- Son sıraya ulaşan taş **dama** olur (üstünde taç). Dama düz çizgide istediği kadar ileri, geri ve yana gider, uzaktaki taşı da alır ve arkasındaki herhangi bir boş kareye konabilir; aynı hamlede geri dönüp ters yöne alamaz. Alırken son sıraya ulaşan taş dama olur ve dama olarak almaya devam eder.
- Rakibin bütün taşlarını alan ya da rakibini hamlesiz bırakan kazanır. **Berabere:** ikinizin de birer taşı kalırsa, aynı pozisyon üç kez tekrarlanırsa ya da 32 hamle boyunca taş alınmazsa.

### Oyna
1. Zorluk seç. 1-5 arası seviyeler bilerek hata yapar; **3 (Kolay+)** iyi bir başlangıç, 8 (Usta) hamle başına en fazla 3,5 saniye düşünür.
2. Rengini seç: **Beyaz (ilk sen başla)** / Siyah / Rastgele.
3. Önce taşına, sonra gideceği kareye dokun. Gidebileceği kareler yeşil noktayla gösterilir. Birden fazla durağı olan bir almada son kareye dokunman yeterli; aynı kareye iki farklı yoldan gidilebiliyorsa ara durağa da dokunursun.
4. Hamleler "c3-c4", alma "d4×d6×f6", dama olma "d7-d8 (dama)" diye yazılır.

**Öğrenme modunda** koç o anki pozisyona göre üç soru sorar: alma zorunlu mu ya da tehlikede taşın var mı, dama yapmaya yakın taş (seninki ya da rakibinki) var mı, taş verip rakibi zorunlu almaya sokabileceğin bir fırsat var mı? **Taş kaptırma uyarısı** kısa bir hesapla (3 yarım hamle ve ardından gelen bütün almalar) bir taş ya da daha fazla kaybettirecek, rakibe dama yaptıracak ya da **zorunlu alma tuzağına** düşürecek bir hamlede çıkar; tehlikedeki taşlar kırmızı, rakibin oynayacağı taş turuncu halkayla gösterilir.

### Analiz
Dama oyunları uygulamada oynadığın oyunlardır. Açıklamalar şunları tanır:
- rakibe taş kaptırma ("Bu hamleden sonra rakip e4×c4 ile 1 taşını alabiliyor"),
- **zorunlu alma tuzağı**: rakip bir taş verir, almak zorunda kalırsın, ardından daha çok taş alır,
- kaçırılan kombinasyon: taş verip rakibi almaya zorlayarak daha çok taş alma fırsatı,
- rakibe dama yaptırma ve dama yapma fırsatını kaçırma,
- zorunlu almada yanlış yolu seçme, zorla kazanılan/kaybedilen oyun sonları.

### Bulmaca
İpucu önce fikri söyler: "Yeşil işaretli taşın dama olabilir", "Bir taşını vermek rakibi zorunlu almaya sokar", "Almak zorundasın ama hangi yoldan?" ya da oyundaki hamlenden sonra alınan taşı kırmızıyla gösterir. Fikir yoksa hangi taşla oynaman gerektiğini işaretler.

---

## Reversi

### Kurallar
- 8 × 8 tahta, ortada çapraz duran dört taşla başlar. **Siyah başlar.**
- Taşını öyle bir kareye koyarsın ki rakibin taşları, yeni taşınla eski bir taşının arasında düz bir çizgide (yatay, dikey ya da çapraz) kalsın. Arada kalan bütün taşlar senin rengine döner.
- Oynayacak yerin yoksa sıra kendiliğinden rakibe geçer. İkiniz de oynayamazsanız oyun biter; tahtada daha çok taşı olan kazanır.
- Kareler Reversi'deki alışılmış biçimde yazılır: sütunlar soldan a-h, satırlar **yukarıdan** 1-8.

### Oyna
1. Zorluk seç. 1-5 arası seviyeler bilerek hata yapar; **3 (Kolay+)** iyi bir başlangıç. 6 ve üstü seviyeler oyunun son 10 hamlesini (8. seviye son 14 hamlesini) sonuna kadar tam hesaplar.
2. Rengini seç: **Siyah (ilk sen başla)** / Beyaz / Rastgele.
3. Oynayabileceğin kareler küçük noktalarla gösterilir. Farenin altındaki kareye oynarsan çevrilecek taşlar soluklaşır. Hamleler "d3 (+2)" diye yazılır (parantezdeki sayı çevrilen taş sayısıdır).
4. Rakibin oynayamazsa "tekrar sen oynuyorsun" yazısı çıkar.

**Öğrenme modunda** koç köşeleri, rakibin kaç oynayacak yeri kaldığını ve oyun sonunda taş sayısını hatırlatır. **Köşe uyarısı**, başka bir hamle köşeyi vermezken rakibe köşe açacak bir hamlede ya da boş bir köşenin çaprazındaki kareye oynadığında çıkar; tehlikedeki köşe turuncu halkayla gösterilir.

### Analiz
Açıklamalar şunları tanır:
- rakibe köşe verme (özellikle köşenin çaprazındaki ya da yanındaki kareye oynayarak),
- köşe alma fırsatını kaçırma,
- rakibe çok oynayacak yer bırakma ("Bu hamleden sonra rakibinin 9 oynayacak yeri var, c4 ile 4 olurdu"),
- oyunun başında gereğinden çok taş çevirme,
- son hamlelerde bilgisayarın sonuna kadar hesapladığı kesin kazanç/kayıplar.

### Bulmaca
İpucu önce köşeleri gösterir ya da oyundaki hamlenin rakibe açtığı köşeyi kırmızıyla işaretler; yoksa doğru hamlenin tahtanın hangi çeyreğinde olduğunu söyleyip oradaki oynanabilir kareleri işaretler.

---

## Analiz ekranı (bütün oyunlarda aynı)

Tahtanın solundaki dikey **üstünlük çubuğu**, tahtadaki pozisyonda senin kazanma şansını gösterir. Her hamlenin yanında bir işaret durur; hamleye dokununca kısa bir açıklama çıkar:

| İşaret | Etiket | Anlamı |
| --- | --- | --- |
| !! | **Parlak** | Taş veren ama doğru olan, en iyi ya da ona çok yakın bir hamle (satranç ve Dama). |
| ! | **Harika** | Tek iyi hamle: ikinci en iyi hamle durumu belirgin şekilde kötüleştirirdi. Taş geri almak ya da şahtan kaçmak gibi doğal hamleler sayılmaz. |
| ★ | **En iyi** | Bilgisayarın da seçeceği hamle. |
| ✓✓ | **Çok iyi** | En iyisine çok yakın (kazanma şansı 2 puandan az düştü). |
| ✓ | **İyi** | Fena değil (5 puandan az düştü); açıklama daha iyisini söyler. |
| □ | **Zorunlu** | Başka yasal hamle yoktu. |
| ?! | **Yanlışlık** | 5-10 puan kaybettirdi. |
| ? | **Hata** | 10-20 puan kaybettirdi. |
| ?? | **Büyük hata** | 20 puan ya da daha fazla kaybettirdi. |

- **İyi hamlelerin açıklaması** hamlenin ne yaptığını söyler: "En iyi hamle. Atı alıyor ve şah çekiyor.", "Son taş hazineye düşüyor, bir daha oynuyor.", "Atari yapıyor: karşıdaki 2 taş bir hamle sonra alınabilir.", "Dama oluyor.", "Köşeyi alıyor, bu taş bir daha çevrilemez."
- **Senin hatalarının açıklaması** neyin ters gittiğini anlatır (aşağıda her oyunun bölümünde). Tahtada kırmızı ok senin hamleni, yeşil ok daha iyisini gösterir.
- **Rakibin hatalarında** bunu nasıl cezalandıracağın yazar: "Rakip hata yaptı. Şimdi en iyi cevap ♘xe5: piyonu alıyor." Tahtadaki yeşil işaret o cevabı gösterir; bulduysan "Sen de bunu buldun!" der.
- **Oyun özeti** her etiketten kaç hamle yaptığını senin ve rakibin için ayrı ayrı gösterir.
- Bu sürümden önce analiz edilmiş oyunlar açıldıklarında kendiliğinden yeniden analiz edilir. Artık her pozisyon incelendiği için analiz eskisinden biraz uzun sürer.

## Dersler (bütün oyunlarda aynı)

Ana ekranda her oyunun ilk düğmesi **Dersler**. Her ders birkaç dakika sürer:
- **Adımlar:** Kısa, büyük harfli açıklamalar ve tahtada örnekler. Önemli kareler işaretlidir.
- **"Sıra sende" alıştırmaları:** Dersin istediği hamleyi tahtada oynarsın. Yanlış hamlede tahta geri döner ve bir ipucu çıkar. İki yanlıştan sonra **Çözümü göster** düğmesi belirir.
- **Ders sonu:** "Unutma" maddeleri çıkar ve ders bitti olarak kaydedilir. Ana ekranda kaç ders bitirdiğin görünür; ilerleme yedeğe de girer.

| Oyun | Dersler |
| --- | --- |
| Satranç | Taşların değeri · Korumasız taşlar · Çatal · Açmaz · Açılışın üç kuralı · Tek hamlede mat |
| Mangala | Taşları dağıtmak · Tekrar oynama hakkı · Çift kuralı · Boş kuyu kuralı · Taşlarını korumak · Oyunun sonu |
| Go | Nefes · Taş yakalamak · Atariden kaçmak · İki göz · Ko kuralı · Alan ve oyunun sonu |
| Dama | Taşların hareketi · Taş almak · Art arda almak · Dama olmak · Taş verip kazanmak · Birlikte durmak |
| Reversi | Taş çevirmek · Köşeler · Köşe yanındaki tehlike · Rakibe az hamle bırak · Oyun sonu |

**Seviye 2 · Taktik ve strateji** (ders listesinde 1. seviyenin altında; önce 1. seviyeyi bitirmen önerilir ama kilitli değildir):

| Oyun | Dersler |
| --- | --- |
| Satranç | Şiş · Açarak saldırı · Mat tehdidini savmak · İki kaleyle mat · Piyonu vezire çıkarmak |
| Mangala | Zincirleme tekrar oynama · Rakibe fırsat verme · Hamleleri saymak · Boş kuyu tehlikesi |
| Go | Kesmek ve bağlamak · Doğru taraftan atari · Çifte atari · Hayati nokta |
| Dama | Dama olmayı engellemek · Damayla art arda almak · Doğru alma yolu |
| Reversi | Rakibi pas geçirmek · Sessiz hamle · Sona kadar hesap |

İkinci seviyenin bazı pozisyonları bilgisayara oynatılan oyunlardan seçildi. Örneğin Reversi'deki oyun sonu dersinde en çok taş çeviren hamle kaybettirir, doğru hamle kazandırır; bunu bilgisayar sona kadar hesaplayarak doğrular.

Alıştırmaların doğru cevapları elle yazılmak yerine çoğu zaman oyunun kurallarından hesaplanır (örneğin "son taşı hazineye düşüren kuyular"). Birden fazla doğru hamle varsa hepsi kabul edilir. Dersler her oyunun `lessons.ts` dosyasındadır; testler her alıştırmanın geçerli bir doğru cevabı olduğunu denetler.

## Bulmacalar (bütün oyunlarda aynı)

- **Kendiliğinden oluşur ve kaydolur:** Bir oyun bittiği anda analizi arka planda başlar. Oyun bitti ekranında ilerleme görünür, sonunda "Hatalarından 2 yeni bulmaca kaydedildi." gibi bir yazı çıkar. Sayfadan çıksan da analiz sürer. Uygulama kapalıyken biten ya da hiç analiz edilmemiş oyunlar, ana ekran açılınca sırayla analiz edilir.
- **Üç bölüm:** Bulmacalar hatanın yapıldığı yere göre **Oyun başı**, **Oyun ortası** ve **Oyun sonu** diye ayrılır. Bölümler her oyunda o oyuna uygun şekilde belirlenir:

  | Oyun | Oyun başı | Oyun sonu |
  | --- | --- | --- |
  | Satranç | İlk 10 hamle | Piyonlar ve şahlar dışında 6 taş ya da daha az kaldığında |
  | Mangala | İlk hamleler | Kuyularda 16 taş ya da daha az kaldığında |
  | Go | 14 taşa kadar | 44 taş olunca ya da boş alan kalmayınca |
  | Dama | 28 taş ve üstü | 12 taş ve altı |
  | Reversi | 20 taşa kadar | 16 boş kare ve altı |

- **Bulmaca sayfası:** Önce bugün tekrar edilecek bulmacaların hepsine birden başlayabilirsin. İstersen bir bölüm seçip yalnızca onu çözebilirsin. Bugün tekrarı olmayan bir bölümü seçersen, en yakında tekrarı gelecek bulmacalardan başlanır.
- Tekrar düzeni aynı: doğru çözdükçe bulmaca üst kutuya çıkar (1, 3, 7, 14, 30 gün), yanlışlar ertesi gün döner.
- Kayıtların **kalıcı olması için uygulamayı kur** ve oyunlarını orada oyna (bkz. "Uygulama olarak kurmak"). Arada bir **Yedekle** düğmesiyle yedek almayı da unutma.

## Ana ekran
Ana ekran her pencere boyutunda (telefon dahil) tek ekrana sığar, aşağı yukarı kaydırma gerekmez. Üstte oyun sekmeleri, solda büyük yeşil **Oyna** düğmesi ve altında **Dersler**, **Analiz**, **Bulmaca** düğmeleri, sağda **oyuncu özeti** vardır (telefonda özet düğmelerin altındadır ve kısadır).

**Oyuncu özeti** (seçili oyun için):
- **Oynayış düzeyin:** Son 10 oyunun bilgisayara karşı sonuçlarından hangi seviyedeki bot gibi oynadığın. Bir seviyeyi yenmek seni o seviyenin bir üstüne, ona yenilmek bir altına koyar; ortalaması alınır. Puan değil, bot seviyesi gösterilir.
- **Sana uygun bot:** Aynı seviyede son 3 oyunun 2'sini kazandıysan bir üst seviye, 2'sini kaybettiysen bir alt seviye, yoksa aynı seviye önerilir. Oyna ekranında bu seviyenin yanında "Sana uygun" yazar.
- **Oyunun aşamaları:** Son 10 analiz edilmiş oyunda oyun başı, ortası ve sonunda 10 hamlede kaç hata ve büyük hata yaptığın; en zor aşama turuncu gösterilir.
- **Dikkat et:** En zor aşaman ve en sık hata türün için kısa birer öğüt.
- **Son oyunların:** Sonuç, botun seviyesi, hata sayısı ve tarih. Birine dokununca o oyunun ayrıntılı analizi açılır. **Verilerin** (yedekleme) ve **Uygulamayı kur** alttaki küçük düğmelerle açılan pencerelerdedir.

**Oyunlar arasında geçiş:** Bilgisayarda **← →** ok tuşları oyunu değiştirir (sondan başa döner), **Enter** seçili oyunu açar; telefonda ekranı sağa ya da sola kaydırmak yeter. İçerik yerinde kalır, yalnızca renkler yumuşakça değişir.

**Her oyunun rengi:** Satranç yeşil, Mangala toprak sarısı, Go çelik mavisi, Dama sakin mor, Reversi koyu turkuaz; hepsi göz yormayan koyu tonlardır. Oyun değişince düğmeler, kartlar ve arkadaki hafif ışık yumuşakça o oyunun rengine geçer; oyunun Oyna, Analiz, Ders ve Bulmaca sayfaları da aynı renktedir. Doğru/yanlış renkleri (yeşil iyi, sarı-turuncu-kırmızı hata) her oyunda aynıdır.

## Puanlar

Doğru hamleler puan getirir, yanlışlar götürür; kazanılan ve kaybedilen oyunlar da öyle. Puan her oyun için ayrıdır, sıfırın altına düşmez ve kayıtlı oyunlardan her seferinde yeniden hesaplanır (yedekten geri yüklenince de aynı çıkar).

| Hamle | Puan |
| --- | --- |
| !! Parlak | +5 |
| ! Harika | +3 |
| ★ En iyi | +2 |
| ✓✓ Çok iyi | +1 |
| ✓ İyi, □ Zorunlu | 0 |
| ?! Yanlışlık | −1 |
| ? Hata | −3 |
| ?? Büyük hata | −5 |

Bilgisayara karşı sonuç: kazanmak **seviye × 5**, berabere **seviye × 2**, kaybetmek **−(9 − seviye) × 3** puan. Güçlü bota kaybetmek az, zayıf bota kaybetmek çok götürür; güçlü botu yenmek çok getirir. Dışarıdan eklenen oyunlarda yalnızca hamle puanı sayılır. Hamle puanı oyun analiz edilince eklenir.

Puan ana ekrandaki özette (son oyunun getirdiğiyle), son oyunlar listesinde, oyun bitti ekranında ve analiz ekranında görünür. Özetteki **📈 satırı** son 10 oyundaki hata oranını önceki 10 oyunla karşılaştırır: uygulamanın işe yarayıp yaramadığını en kolay buradan görürsün.

## Sesler

Taş oynarken kısa bir tok ses, taş alınca çift ses, düğmelerde hafif bir tık, doğru cevapta ve kazanınca yumuşak bir zil, yanlışta ve kaybedince alçak bir ses çalar. Sesler cihazda üretilir (ses dosyası yoktur). Sağ üstteki **🔊** düğmesi sesi açıp kapatır; seçim hatırlanır.

**Tam ekran:** Ana ekranın ve her sayfanın sağ üstündeki ⛶ düğmesi uygulamayı tam ekran yapar; aynı düğme ya da Esc tuşu tam ekrandan çıkarır. Uygulamayı tam ekranda bırakıp kapattıysan, bir sonraki açılışta ilk dokunuşta ya da tuşa basışta yine tam ekrana geçer (tarayıcılar tam ekrana ancak bir dokunuştan sonra izin verir). Edge'in kendi tam ekranı için F11 de kullanılabilir.

Bulmaca düğmesinde o gün seni bekleyen bulmaca sayısı görünür.

## Nasıl çalışır (kısaca)

- **Sınıflandırma** ham puan farkına değil, **kazanma şansındaki düşüşe** göre yapılır. Düşüş 5 puan ve üstü **Yanlışlık**, 10 ve üstü **Hata**, 20 ve üstü **Büyük hata** sayılır; 0,5 puanın altı **En iyi**, 2 puanın altı **Çok iyi**, geri kalanı **İyi**. **Harika** için en iyi hamle ile ikinci en iyi hamle arasında en az 15 puan olmalı; **Parlak** için hamle taş vermeli (satrançta karşı tarafın alıp en az 2 piyon değerinde kazanabileceği bir taş) ve oyun zaten tamamen kazanılmış olmamalı. Böylece zaten kazandığın bir oyunda "daha hızlı kazanabilirdin" diye ceza yemezsin. Zorla kazanılan/kaybedilen durumlar %100 / %0 sayılır. Eşikler `src/core/classify.ts` dosyasında, bütün oyunlar için ortaktır. Hamlelerin ne yaptığını her oyunun `describe.ts` dosyası söyler.
- **Kazanma şansı:** Satrançta motor puanından (Lichess'in eğrisi), Mangala'da hazineler arasındaki taş farkından (5 taş önde ≈ %73), Go'da beklenen alan farkından (8 alan önde ≈ %73), Dama'da taş farkından (1 taş önde ≈ %65, bir dama önde ≈ %86), Reversi'de pozisyon değerlendirmesinden (bir köşe önde ≈ %62) hesaplanır.
- **Satranç motoru:** Stockfish 19'un tek çekirdekli "lite" WASM sürümü, Web Worker içinde.
- **Mangala motoru:** Uygulamaya özel yazıldı: alfa-beta araması, derinleşen arama ve daha önce hesaplanan pozisyonları hatırlama. Tekrar oynama kuralını hesaba katar (aynı oyuncu tekrar oynadığında puanı ters çevirmez). 14 hamle derinliğe bir saniyenin altında iner ve Web Worker içinde çalışır.
- **Go motoru:** Uygulamaya özel yazıldı: Monte Carlo ağaç araması (RAVE ile). Her pozisyondan binlerce rastgele oyunu sonuna kadar oynayıp en çok kazandıran hamleyi seçer; rastgele oyunlar bile basit kurallara uyar (atarideki grubu kurtar, yakalanabilecek taşı al, kendi gözünü doldurma). Seviyeler düşünülen oyun sayısıyla ayrılır (1. seviye 150, 8. seviye 30.000 oyun); 8. seviye bilgisayarda hamle başına 1,5-2 saniye düşünür. Analizde pozisyon başına 10.000 oyun oynanır ve aynı pozisyon hep aynı sonucu verir.
- **Go'da adil karşılaştırma:** Bu tür arama, sırası gelen taraf için biraz iyimserdir (9×9'da 2-4 alan). Bu yüzden Go analizinde senin hamlen motorun önerisiyle aynı şekilde ölçülür: en iyi hamleden sonraki pozisyon da ayrıca incelenir. Böylece iyi hamleler yanlışlıkla "hata" sayılmaz. Bulmaca cevapları da aynı yolla kontrol edilir.
- **Go'da ölü taş ve sayım:** Ölü taşlar, tahtanın şekli (iki göz için yeri olmayan ve rakip tarafından çevrilmiş gruplar) ile rastgele oyunların sonunda taşın kime kaldığı birlikte değerlendirilerek tahmin edilir. Karışık pozisyonlarda yanılabilir; bu yüzden oyun sonunda dokunarak düzeltilebilir.
- **Dama ve Reversi motorları:** İkisi de uygulamaya özel yazılmış ortak bir alfa-beta aramasını kullanır (derinleşen arama, daha önce hesaplanan pozisyonları hatırlama, PVS). Dama'da alma zorunlu olduğu için alma sürerken arama derinlik sınırında durmaz; Reversi'de oyun sonu yaklaşınca arama son hamleye kadar iner ve sonuç kesinleşir. En güçlü seviyelerde düşünme süresi sınırlıdır (Dama 3,5 sn, Reversi 3 sn).
- **Taş bırakma / kaptırma tespitleri** gerçek kurallarla hesaplanır. Koç uyarıları yalnızca daha güvenli bir hamle varsa çıkar; kurtarılamayan bir durum için her hamlede seni rahatsız etmez.

## Google ile eşitleme (farklı cihazlar)

Ana ekranın altındaki **☁️ Eşitle** düğmesi oyunlarını, bulmacalarını ve derslerini Google hesabınla eşitler. Kayıtlar senin Google Drive'ında, yalnızca bu uygulamanın görebildiği gizli bir klasörde tek bir dosya olarak durur; başka hiçbir yere gitmez ve Drive'ındaki diğer dosyalarına dokunulmaz.

- **Eşitle:** Önce Drive'daki kayıtlar bu cihaza eklenir, sonra bu cihazın kayıtları Drive'a yazılır. Hiçbir şey silinmez; aynı oyun iki kez eklenmez, bir oyunun hangi cihazdaki analizi daha yeniyse o kalır, bitirilen dersler birleşir.
- **Otomatik:** Bağlandıktan sonra o açılışta her oyun bitip analiz edilince eşitleme kendiliğinden yapılır. Uygulamayı yeniden açınca bir kez **Eşitle**'ye basman yeter (Google genelde bir şey sormaz).
- **Bağlantıyı kes:** Bu cihazda hesabı unutur; Drive'daki kayıtlar durur.

Telefondan da kullanabilmek için uygulamanın internette olması gerekir (bilgisayardaki `localhost` adresine telefon ulaşamaz). Bunun için ücretsiz GitHub Pages kullanılır. Kurulum bir kez yapılır:

### 1. Uygulamayı internete koymak (GitHub Pages)
1. https://github.com adresinde bir hesap aç (varsa gerek yok).
2. **New repository** ile `akil-oyunlari` adında, **Public** ve boş (README eklemeden) bir depo oluştur. (Ücretsiz hesaplarda Pages yalnızca herkese açık depolarda çalışır: kod herkese açık olur, ama oyunların ve kayıtların kodda değil, cihazında ve Drive'ındadır.)
3. Deponun **Settings → Pages** bölümünde **Source** olarak **GitHub Actions**'ı seç.
4. Kodu depoya gönder (git ilk seferde tarayıcıda GitHub girişi ister). Her gönderimde `.github/workflows/yayinla.yml` testleri çalıştırır, uygulamayı hazırlar ve yayınlar. Adres: `https://KULLANICI-ADIN.github.io/akil-oyunlari/`.

### 2. Google girişini açmak (Google Cloud)
1. https://console.cloud.google.com adresine Gmail hesabınla gir ve yeni bir proje oluştur (örneğin "Akil Oyunlari").
2. **APIs & Services → Library** bölümünde **Google Drive API**'yi bul ve **Enable** de.
3. **Google Auth Platform** (ya da **OAuth consent screen**) bölümünde: uygulama adı "Akıl Oyunları Koçu", destek e-postası olarak kendi adresin, **Audience: External**, yayın durumu **Testing**. **Test users** listesine uygulamayı kullanacağın Gmail adreslerini ekle.
4. **Clients → Create client → Web application** seç. **Authorized JavaScript origins** kısmına şunları ekle: `https://KULLANICI-ADIN.github.io`, `http://localhost:4173`, `http://localhost:5173`. Oluştur ve **Client ID**'yi kopyala (`….apps.googleusercontent.com` ile biter; gizli değildir).
5. Client ID'yi `src/config.ts` dosyasındaki `GOOGLE_CLIENT_ID` değerine yaz ve kodu tekrar gönder.

İlk bağlanışta Google "Bu uygulama doğrulanmadı" diyebilir: uygulama senin kendi test uygulaman olduğu için **Devam**'a basman yeterli. Google, uygulamadan yalnızca Drive'daki kendi gizli klasörünü ve e-posta adresini görme izni ister.

## Verilerin nerede?

Oyunlar, analizler, bulmacalar ve ayarlar tarayıcının **IndexedDB** deposunda, senin cihazında saklanır; Google ile eşitlemeyi açarsan bir kopyası da kendi Drive'ında durur. Tarayıcı verilerini (site verilerini) silersen bunlar da silinir. Farklı tarayıcı ya da cihazların verileri birbirinden ayrıdır; kurulan uygulamanın verileri de tarayıcıdakinden ayrıdır.

**Yedek:** Ana ekranın en altındaki **Yedekle** düğmesi her şeyi tek bir `.json` dosyasına indirir; **Yedeği yükle** bu dosyayı başka bir tarayıcıya, cihaza ya da kurulan uygulamaya ekler. Yükleme buradaki hiçbir şeyi silmez: aynı oyunlar iki kez eklenmez, bir bulmaca iki yerde de varsa en son çalışılan hâli kalır, burada zaten olan ayarlar değişmez. Arada bir yedek almak, tarayıcı verileri silinirse her şeyi geri getirmenin tek yoludur. Uygulamanın satranç-only eski sürümünden kalan veriler ilk açılışta otomatik olarak yeni biçime taşınır.

## Sorun giderme

| Sorun | Çözüm |
| --- | --- |
| "Uygulamayı Başlat" açılıp hemen kapanıyor ya da "Node.js bulunamadı" diyor | https://nodejs.org adresinden Node.js LTS sürümünü kur, sonra tekrar çift tıkla. |
| Başlatıcı "4173 numaralı port kullanımda" diyor | Başka bir pencerede uygulama zaten çalışıyor olabilir: o pencereyi kapatıp tekrar dene. |
| PowerShell'de `npm` "running scripts is disabled" hatası veriyor | `npm` yerine `npm.cmd` yaz (örneğin `npm.cmd run app`). |
| "Uygulamayı yükle" simgesi çıkmıyor | Adresin **http://localhost:4173** olduğundan emin ol (`npm.cmd run app` ile açılan). Geliştirme adresi 5173 kurulmaz. Menüden yüklemeyi dene: Edge'de ⋯ → Uygulamalar. |
| Kurulan uygulama eski görünüyor | `npm.cmd run app` çalıştır, uygulamayı aç, kapatıp bir kez daha aç. |
| "Satranç motoru yüklenemedi" | `npm install` komutunu tekrar çalıştır (motor dosyaları yeniden kopyalanır), sonra sayfayı yenile. |
| Chess.com oyunları gelmiyor | Kullanıcı adını kontrol et. Bağlantı hatası alırsan oyunu PGN olarak yapıştır. |
| Kodu değiştirdikten sonra sayfa boş ya da eski görünüyor | `npm run dev`'i `Ctrl + C` ile durdurup yeniden başlat ve sayfayı yenile. |
| Analiz telefonda yavaş | Normal; telefonlar bilgisayardan birkaç kat yavaştır. Analiz sırasında sayfada kal. Uzun bir 9×9 Go oyununun analizi bilgisayarda yaklaşık 40 saniye sürer. |
| SGF dosyası eklenmiyor | Şimdilik yalnızca 9×9 Go oyunları desteklenir. Hata mesajı hangi hamlenin okunamadığını söyler. |

## Proje yapısı

```
src/
  core/               oyundan bağımsız kısımlar
    types.ts          her oyunun uyguladığı ortak "oyun modülü" arayüzü
    classify.ts       İyi / Yanlışlık / Hata / Büyük hata eşikleri
    humanize.ts       kolay seviyelerin "insan gibi" hamle seçimi
    alphabeta.ts      Dama ve Reversi'nin ortak alfa-beta araması
    workerEngine.ts   aramayı Web Worker'da çalıştıran ortak motor sarmalayıcısı
    analysis/         genel analiz döngüsü ve oyun özeti
    puzzles/          bulmaca üretimi, Leitner tekrarı, cevap kontrolü
    stats/            ana ekrandaki ilerleme özeti
  games/
    registry.ts       oyun listesi (ana ekran sekmeleri)
    chess/            satranç modülü: Stockfish, taş bırakma ve taktik tespitleri,
                      açıklamalar, PGN ve Chess.com içe aktarma, tahta
    mangala/          Mangala modülü: kurallar, arama motoru ve Web Worker'ı, seviyeler,
                      açıklamalar, bulmaca ipuçları, koç, tahta
    go/               Go modülü: kurallar ve sayım, hızlı tahta ve Monte Carlo araması,
                      Web Worker, seviyeler, SGF okuma/yazma ve içe aktarma, açıklamalar,
                      bulmaca ipuçları, koç, SVG tahta
    dama/             Dama modülü: kurallar (uçan dama, en çok alma), motor ve Web Worker,
                      seviyeler, açıklamalar, bulmaca ipuçları, koç, SVG tahta
    reversi/          Reversi modülü: kurallar, motor ve Web Worker, seviyeler,
                      açıklamalar, koç ve bulmaca ipuçları, SVG tahta
  db/                 IndexedDB katmanı, eski verilerin otomatik taşınması, yedekleme
  pages/              Ana ekran, Oyna, Analiz, Bulmaca (seçili oyunun modülünü kullanır)
  components/         hamle listesi, analiz ekranı, oyun listesi gibi ortak parçalar
scripts/copy-stockfish.mjs   Stockfish dosyalarını public/ klasörüne kopyalar
src/games/<oyun>/lessons.ts  o oyunun 1. seviye dersleri, lessons2.ts 2. seviye dersleri
                             (src/pages/Lessons.tsx dersleri oynatır)
scripts/start-app.mjs        çift tıklanan başlatıcının işi: kurar, gerekirse hazırlar, başlatır, açar
Uygulamayı Başlat.cmd        çift tıklanınca uygulamayı başlatır
scripts/offline-app.ts       build sırasında uygulamanın internetsiz çalışmasını sağlayan sw.js dosyasını yazar
scripts/make-icons.mjs       uygulama simgelerini çizer (public/icons/)
public/manifest.webmanifest  uygulamanın adı, simgeleri ve renkleri (kurulum için)
```

Yeni bir oyun eklemek için `games/<oyun>/` altında `GameModule` arayüzünü (kurallar, motor, açıklamalar, koç, tahta) uygulayıp `games/registry.ts` listesine eklemek yeterli; Oyna, Analiz, Bulmaca ve ilerleme ekranları hazır gelir.

## Lisans notu

Satranç motoru [Stockfish.js](https://github.com/nmrugg/stockfish.js) GPL-3.0 lisanslıdır.
