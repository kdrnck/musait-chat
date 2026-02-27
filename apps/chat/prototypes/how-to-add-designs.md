# Yeni Sayfa Ekleme Teknik Rehberi

Bu döküman, mevcut prototip sistemine yeni bir HTML sayfası eklemek için gereken teknik adımları ve yapısal gereksinimleri içerir.

---

## Dosya Yapısı

Tüm yeni tasarımlar `designs/` klasörü altına eklenmelidir:

```
apps/chat/prototypes/
├── index.html              ← Ana carousel sayfası
└── designs/
    ├── design-1-brutalist.html
    ├── design-2-glass.html
    ├── design-3-organic.html
    ├── design-4-deco.html
    ├── design-5-login.html
    └── design-6-yeni-sayfa.html  ← Yeni dosyanızı buraya ekleyin
```

---

## Sisteme Kayıt

Yeni oluşturduğunuz dosyayı `index.html` içindeki `DESIGNS` dizisine eklemeniz gerekir. Bu diziye ekleme yapıldığında navigasyon okları ve noktaları otomatik olarak güncellenir.

**Konum:** `index.html` > `<script>` > `const DESIGNS = [...]`

```javascript
const DESIGNS = [
  // ... mevcut kayıtlar
  { 
    file: 'designs/design-6-yeni-sayfa.html', 
    name: 'Sayfa Adı', 
    tag: '#6' 
  },
];
```

---

## Teknik Gereksinimler

Sistemin tutarlı çalışması için sayfada bulunması gereken temel teknik yapılar aşağıdadır.

### Bulunması Gereken UI Bileşenleri

| Bileşen | İşlev |
|---------|-------|
| **Sol Kenar Çubuğu** | Konuşma listesi alanı |
| **Arama/Filtre** | Liste içi arama ve durum filtreleri (Tümü, Okunmamış, Devralma) |
| **Sohbet Alanı** | Mesaj geçmişi ve başlık |
| **Mesaj Girişi** | Metin alanı (textarea) ve gönder butonu |
| **Detay Paneli** | Sağ tarafta müşteri/detay bilgilerinin yer aldığı alan |
| **Durum Etiketleri** | AI, İnsan, Dikkat gibi durum göstergeleri |

### Zorunlu JavaScript Davranışları

Sayfa içi etkileşimlerin simüle edilmesi için aşağıdaki davranışlar implement edilmelidir:

1.  **Metin Alanı:** Yazılan içeriğe göre yüksekliği otomatik artmalıdır.
2.  **Mesaj Gönderimi:** Gönder butonuna tıklandığında mesaj geçici olarak DOM'a eklenmeli ve scroll aşağı kaymalıdır.
3.  **Filtre/Liste Seçimi:** Elemanlara tıklandığında "active" sınıfları güncellenmelidir.
4.  **Araç Çağrıları:** Sayfadaki "Tool Call" blokları tıklandığında içerikleri açılıp kapanmalıdır (Accordion).

---

## Mock Veri Standartı

Tüm sayfaların aynı bağlamda değerlendirilebilmesi için aşağıdaki verilerin kullanılması önerilir:

**Aktif Kullanıcı:** Elif Yılmaz (+90 532 •••• 45 67)
**Konuşma Akışı:**
- Kullanıcı: "Merhaba, yarın saç kesimi için randevu alabilir miyim?"
- Sistem: `check_availability()` (Tool Call)
- Yanıt: Yarınki uygun saatlerin listesi.
- Kullanıcı: "15:00 olabilir mi?"
- Sistem: `create_appointment()` (Tool Call - Bekliyor)
- Durum: "Yazıyor..." göstergesi.

---

## HTML Şablonu

Sayfalar standalone (bağımsız) çalışacak şekilde tasarlanmalıdır.

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    /* Tüm stiller burada (Standalone) */
    :root { /* Değişkenler */ }
    * { box-sizing: border-box; }
    .app { display: flex; height: 100vh; overflow: hidden; }
    /* Responsive Breakpoints: 768px, 1024px */
  </style>
</head>
<body>
  <div class="app">
    <!-- Sidebar / Main / Panel yapısı -->
  </div>
  <script>
    /* Etkileşim kodları */
  </script>
</body>
</html>
```
