# Caller ID Mobile Integration Contract

## Base URL

Geçici sunucu:

http://213.159.6.179

Canlı domain + SSL sonrası bu değer değiştirilecektir.

## Endpoint

Mobil uygulama Nginx üzerinden şu endpoint'i kullanır:

POST {BASE_URL}/api/caller-device-events/incoming

Backend tarafındaki route:

POST /caller-device-events/incoming

Alternatif route:

POST /caller-events/device/incoming

## Headers

Content-Type: application/json
x-caller-device-key: <deviceKey>

## Request Body

{
  "phone": "05320001122",
  "source": "ANDROID_CALLER_ID",
  "payload": {
    "appVersion": "0.1.0",
    "platform": "android",
    "deviceModel": "Android",
    "eventType": "incoming_call",
    "rawState": "RINGING"
  }
}

## Hata Durumları

- 401 / 403: Cihaz anahtarı hatalı, eksik veya pasif.
- 400: Telefon numarası eksik veya body hatalı.
- 500: Backend hatası.
