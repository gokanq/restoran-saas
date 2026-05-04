# Restoran SaaS Caller ID Android

Bu uygulama Android telefon veya Caller ID cihazından gelen aramaları Restoran SaaS backend'e iletmek için hazırlanmıştır.

## Ana Akış

1. Panelden Caller ID cihaz anahtarı oluşturulur.
2. Android uygulamaya Base URL ve cihaz anahtarı kaydedilir.
3. Uygulama test event gönderebilir.
4. Gerçek cihazda telefon çaldığında gelen numara backend'e iletilir.
5. Dashboard'da Caller ID popup açılır.
6. Çağrı geçmişine kayıt düşer.

## Backend Endpoint

Nginx üzerinden:

POST /api/caller-device-events/incoming

Header:

x-caller-device-key: <cihaz_anahtari>
Content-Type: application/json

Body örneği:

{
  "phone": "05320001122",
  "source": "ANDROID_CALLER_ID",
  "payload": {
    "appVersion": "0.1.0",
    "platform": "android",
    "eventType": "incoming_call"
  }
}

## İlk Test Akışı

1. /dashboard/caller-id sayfasından yeni cihaz anahtarı oluştur.
2. Android uygulamada Base URL alanına şunu gir: http://213.159.6.179
3. Cihaz anahtarını uygulamaya yapıştır.
4. Test Event Gönder butonuna bas.
5. Dashboard'da popup ve Caller ID geçmişini kontrol et.

## Not

Bu ilk iskelet sürümdür. Gerçek telefon araması yakalama kısmı cihaz, Android sürümü, izinler ve üretici kısıtlarına göre ayrıca test edilecektir.
