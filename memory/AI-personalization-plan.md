# AI Personalization Plan

Durum: Draft v0.1 (inşaya başlamadan önce netleştirme)
Kapsam: `musait-chat` (worker + chat UI) ve `musait-dev` (tenant ayarları / Supabase şeması)

## 0) Karar Logu (Onaylananlar)

- İsim güveni düşükse anında değil, randevuya yakın noktada tekrar sor.
- Müşteri isim düzeltmesi ("adım X değil Y") geldiğinde isim güncellensin ve özür mesajı dönsün.
- İsim hitabı sadece selam ve onay/özet mesajlarında doğal şekilde geçsin.
- Master numarada son işletme varsayılsın.
- İşletme değişimi triggerları aktif olsun ve tenant değişince konuşma yeni tenant kaydına taşınsın.
- Tenant ek prompt `integration_keys` içinde tutulabilir.
- Tenant prompt düzenleme yetkisi: sadece owner + admin.
- Linkte varsayılan numara inbound numara olsun.
- Handoff: 24 saat sonra otomatik AI açılabilir, manuel açma her zaman mümkün.
- Handoff insan mesajları ilgili inbound numaradan çıksın.
- Müşteri notları serbest metin olsun.
- Thinking sadece karmaşık mesajlarda aktif olsun, token düşük tutulsun.
- OpenRouter provider: DeepInfra öncelikli, fallback açık.

## 1) Hedef Özeti

- WhatsApp üzerinden gelen müşteri numarası ile müşteri ismini eşleyip yanıtlarda isme göre hitap etmek.
- İlk kez gelen müşteride isim sorup mock profil oluşturmak ve randevu kaydını doğru tenant + customer mantığıyla yapmak.
- Katı adım adım flow yerine, tek mesajda gelen çoklu bilgiyi (işletme + hizmet + gün + saat) ayrıştırıp minimum adımda randevu oluşturmak.
- Açılış/greeting mesajlarında işletmeye özel hizmet listesi linkini paylaşmak.
- Multi-tenant yapıda tenant bazlı ek sistem prompt yönetimi eklemek (işletme ayarından düzenlenebilir).
- `chat.musait.app` handoff modunu kesinleştirmek: AI pasifken sadece insan mesajları gidip gelsin, AI 24 saat/manuel açılana kadar devre dışı kalsın.
- Sohbet ekranına “Müşteri Notları” alanı eklemek ve AI bağlamına dahil etmek.
- Master numarada işletme değiştirmeyi desteklemek ve müşteri bazlı çapraz-tenant hafıza davranışı tanımlamak.

## 2) Mevcut Teknik Durum (Koddan Çıkan)

- Worker akışı: `routeMessage` (tenant bağlama) -> `handleStructuredBookingFlow` (zorunlu service/staff/date/time) -> sonra LLM.
- Bu sıralama nedeniyle tek mesajda dağınık bilgi gelse bile flow çoğunlukla “zorla adım” modunda kalıyor.
- `create_appointment` aracı customer kaydını numarayla buluyor/oluşturuyor; isim parametresi var ama akışta sistematik kullanılmıyor.
- Webhook tarafında `contactName` geliyor ama müşteri profiline/DB customer adına otomatik işlenmiyor.
- Handoff: konuşmayı `handoff` statüsüne alıp AI’yı 24 saat kapatan alanlar var; fakat chat UI’dan yazılan “human” mesajlarının WhatsApp’a gönderim hattı eksik.
- Tenant bazlı ek prompt alanı şu an yok; `tenants.integration_keys` alanı mevcut ve bu amaçla genişletilebilir.
- Model çağrısı OpenRouter üzerinden; varsayılan model `deepseek/deepseek-chat`. DeepInfra routing/thinking parametresi kodda açık tanımlı değil.

## 3) Netleştirme Soruları (10-15)

1. İsim kaynağı öncelik sırası nasıl olsun?
   - Öneri: `customers.name` > WhatsApp `contact.profile.name` > konuşmada sorulan isim.
2. İsim güncelleme kuralı ne olsun?
   - Müşteri yeni ad söylediğinde mevcut kayıt otomatik güncellensin mi, yoksa sadece boşsa mı doldurulsun?
3. İlk mesajta isim yoksa AI anında isim sorsun mu, yoksa randevu detaylarını toparladıktan sonra eksik alan olarak mı sorsun?
4. İsim kullanım standardı nasıl olsun?
   - Her mesajda mı, sadece ilk selam + kritik onay mesajlarında mı?
5. Master numara için işletme seçimi davranışı ne olsun?
   - Her yeni oturumda mı sorulsun, yoksa son kullanılan tenant varsayılsın ama “değiştir” komutuyla override mı edilsin?
6. İşletme değiştirme tetikleyicileri hangi ifadeler olsun?
   - Örn: “başka işletme”, “X kuaförde randevu”, “işletme değiştir”.
7. Tenant bazlı ek sistem promptu nerede tutalım?
   - Öneri: yeni kolon yerine `tenants.integration_keys.ai_extra_system_prompt` (hızlı ve geriye uyumlu).
8. Ek prompt ekranı hangi kullanıcılar düzenleyebilsin?
   - Sadece master + tenant owner/manager mı, yoksa tüm tenant user rolleri mi?
9. Greeting mesajındaki hizmet link formatı kesin olarak bu mu?
   - `https://musait.app/b/[slug]/backToWhatsapp?number=<inbound_number>`
   - Buradaki `number` değeri inbound WhatsApp numarası mı, işletme telefonu mu?
10. Handoff modunda insan mesajları hangi numaradan çıkmalı?
    - Her zaman ilgili conversation’ın inbound number’ı (tenant numarası/master numarası) doğru mu?
11. AI yeniden devreye alma kuralı nasıl olsun?
    - Sadece staff “AI’ı Devam Ettir” butonuyla mı, yoksa 24 saat dolunca otomatik mi?
12. Müşteri notları alanı düz metin mi yoksa etiketli yapı mı olsun?
    - Öneri: kısa vadede düz metin + append history; orta vadede etiketli notlar.
13. “Thinking mode” politikasını nasıl istiyorsunuz?
    - Her mesajda zorunlu mu, yoksa sadece çok değişkenli/karmaşık mesajlarda mı?
14. OpenRouter provider zorlaması istiyor musunuz?
    - Öneri: DeepInfra öncelikli + fallback açık (erişilebilirlik için).
15. Randevu onay kuralı (explicit confirmation) sabit mi kalacak?
    - Minimum adım istiyoruz ama yasal/operasyonel risk için “onay almadan create yok” kuralı korunacak mı?

## 4) Uygulama To-Do Backlog (Onay Sonrası)

## A. Kişiselleştirme ve müşteri kimliği
- [x] Müşteri isim çözümleme stratejisi (DB + WhatsApp contact + konuşma içi tespit) uygulandı.
- [x] `customers` kaydı bulunursa isim fallback/güncelleme politikası uygulandı.
- [x] İlk kez gelen müşteri için randevuya yakın noktada isim isteme state’i eklendi.
- [x] Agent yanıtlarında isim kullanımı için prompt + response policy eklendi.

## B. Dinamik akış (katı flow yerine niyet+slot odaklı)
- [ ] Structured flow’un zorunlu adımları gevşetilecek; tek mesajdan çoklu slot bilgisi parse edilecek.
- [ ] Mesajdan çıkarılabilen alanlar (tenant/service/staff/date/time) kısmi state’e işlenecek.
- [ ] Eksik en az alan sorularak akış tamamlanacak.
- [ ] İlk uygun cevapta slot gösterimi + tek adım onay pattern’i uygulanacak.

## C. Master tenant routing ve işletme değiştirme
- [x] Master conversation tenant bağlama davranışı “switch-aware” hale getirildi.
- [x] Son kullanılan tenant hafızası ve override komutları eklendi.
- [x] Tenant değişim olayı müşteri notlarına otomatik işlendi (global memory note).

## D. Tenant bazlı prompt yönetimi
- [x] `musait-dev` işletme ayarlarına “AI Ek Sistem Prompt” alanı eklendi.
- [x] Kaydedilen değer worker system prompt’una tenant bazlı enjekte edildi.
- [x] Owner/admin yetki kontrolü + uzunluk sınırı eklendi.

## E. Greeting + link stratejisi
- [x] Greeting kurallarına işletme slug tabanlı hizmet linki eklendi.
- [x] Linkte dinamik `number` parametresi inbound number fallback ile üretildi.
- [ ] Multi-tenant/master numara ayrımına göre işletme adını yazma akışının tüm varyantları tamamlanacak (devam).

## F. Handoff düzeltmesi (chat.musait.app)
- [x] Handoff’ta AI pasifken insan mesajı outbound WhatsApp’a iletiliyor.
- [x] 24 saat kilit + manuel açma + süre dolunca otomatik açılma kodlandı.
- [x] Human mesaj pipeline’ında status/retry/fail görünürlüğü altyapısı eklendi.
- [ ] “AI kapalıyken müşteri mesajı sadece insan paneline düşsün” UX akış iyileştirmeleri (devam).

## G. Müşteri notları + memory
- [x] Chat UI’da düzenlenebilir “Müşteri Notları” alanı eklendi.
- [x] Notlar Convex `customerProfiles.personNotes` ile senkron tutuluyor.
- [x] LLM context build aşamasına notlar deterministik formatta ekleniyor.

## H. LLM provider/routing/thinking
- [x] OpenRouter çağrısına provider routing (DeepInfra öncelik/fallback) eklendi.
- [x] “thinking on” yalnızca karmaşık mesajlar için parametreleştirildi.
- [ ] Token/latency ölçümü için temel log metrikleri (devam).

## I. Test ve güvence
- [ ] Kritik e2e senaryolar: ilk müşteri, isimli müşteri, tek mesajda çoklu bilgi, handoff, tenant switch.
- [ ] Geriye dönük uyumluluk: mevcut appointment/create/cancel akışları.
- [ ] Operasyonel guardrail: tenant isolation ve yanlış tenant’a yazma engeli.

## 5) Kabul Kriterleri (Özet)

- Müşteri adı biliniyorsa AI en az selam ve onay mesajlarında adı kullanır.
- İlk defa yazan müşteride isim sorulur ve kayıt altına alınır.
- Tek mesajda gelen çoklu bilgiyle minimum adımda randevu tamamlanır.
- Handoff modunda AI cevap üretmez; insan mesajı WhatsApp’a gider.
- Tenant bazlı ek sistem prompt kaydedildiği anda aktif olur.
- Master agent işletme değişimini destekler ve müşteri notlarına geçmiş düşer.

## 6) Onay Sonrası İnşa Sırası (Öneri)

1. Dinamik akış iyileştirmesi (tek mesajdan çoklu bilgi)
2. Handoff UX rafinesi (AI kapalı durumda görünür durum yönetimi)
3. Token/latency metrikleri + maliyet gözlemi
4. Master memory davranışının tuning’i (varsayım eşikleri)
