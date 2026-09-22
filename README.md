# Arıza Bildirim ve Takip Sistemi

Bu proje, işletmeler, fabrikalar ve üretim tesisleri için geliştirilmiş, makine ve maliyet merkezlerine entegre olarak çalışan modern bir **Arıza Bildirim ve Takip** otomasyonudur.

## Özellikler

- **Tam Mobil Uyumlu (PWA):** iOS ve Android cihazlarda tarayıcı üzerinden "Ana Ekrana Ekle" özelliğiyle gerçek bir mobil uygulama (App) gibi çalışır.
- **Akıllı ve Dinamik Form:** Seçilen bölüme (Maliyet Merkezi) göre sadece o bölüme ait makineleri listeleyerek kullanıcının hata yapmasını engeller.
- **Canlı Takip Paneli:** Açık ve çözülmüş arızalar iş türlerine göre (Mekanik, Elektrik, İSG vb.) renk kodlarıyla gruplanarak anlık listelenir.
- **Kapsamlı Admin Paneli:** Yetkili girişinden sonra;
  - Bildirilen arızalara "Bakım Operatörü" atama,
  - Arızaları tek tuşla "Çözüldü" olarak işaretleme veya hatalı kayıtları tamamen silme,
  - Sistemdeki "Vardiya", "İş Türü" ve "Operatör" listelerini özelleştirme imkanı.
- **Google Sheets Entegrasyonu:** Tek bir tuşla mevcut Google Excel tablosuna bağlanıp, yüzlerce makine ve bölüm verisini saniyeler içinde çekerek sistemi günceller.
- **Firebase Altyapısı:** Arka planda Firebase Firestore kullanarak verileri anlık (real-time) kaydeder ve tüm kullanıcılarda sayfayı yenilemeye gerek kalmadan listeleri canlı günceller.

## Kurulum ve Kullanım

Proje tamamen Frontend mimarisi (HTML, CSS, JS) üzerine kuruludur. Herhangi bir sunucu kurulumuna gerek yoktur.

1. Projeyi bilgisayarınıza indirin (`git clone`).
2. Github Pages, Vercel, Netlify gibi ücretsiz platformlara direkt yükleyebilir veya herhangi bir yerel sunucuda (`Live Server` vb.) açabilirsiniz.
3. Form ekranı için `index.html` sayfasını açmanız yeterlidir.

**Önemli Not:** Admin işlemlerine girebilmek için Takip Panelindeki `Admin Girişi` butonunu kullanabilirsiniz. (Mevcut test şifresi: `12345` olarak belirlenmiştir).

## Kullanılan Teknolojiler

- HTML5 & CSS3 (Modern Glassmorphism tasarım dili)
- Vanilla JavaScript
- Google Firebase (Firestore Database)
- Google Sheets API (Toplu Veri Çekme İşlemleri)


### V4.1.8 Düzeltmesi
- İş isteğinin iki kez oluşmasına neden olan çift gönderim tetikleyicisi kaldırıldı.
- Gönderim sırasında ikinci tıklamayı engelleyen işlem kilidi eklendi.
- Hata oluşursa gönderim kilidinin güvenli şekilde açılması sağlandı.
- Service Worker önbellek sürümü yenilendi.


#### V3 Değişiklikleri
- Arıza Bak ve WhatsApp ikonları büyütüldü.
- Üst menü modern cam kart tasarımına geçirildi.
- Mobil dokunma alanları ve yazı okunabilirliği artırıldı.
- Üst menü ile adım göstergesi arasındaki boşluk düzenlendi.
