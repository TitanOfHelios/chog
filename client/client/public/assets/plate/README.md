# İsim plakası modelleri

Bu klasöre istediğiniz kadar `.glb` isim plakası modeli koyup
`manifest.json` içine kaydedin — login ekranında otomatik olarak
seçilebilir hale gelirler.

## Nasıl eklenir

1. `.glb` dosyanızı bu klasöre kopyalayın (örn. `neon.glb`).
2. `manifest.json` dosyasına bir satır ekleyin:

```json
[
  { "id": "neon", "file": "neon.glb", "label": "Neon" },
  { "id": "ahsap", "file": "ahsap.glb", "label": "Ahşap Tabela" }
]
```

- `id`: benzersiz bir anahtar (harf/rakam, boşluksuz). Sunucuya/diğer
  oyunculara bu id gönderilir.
- `file`: bu klasördeki dosya adı.
- `label`: login ekranında görünecek isim.

## Hiç plaka eklemezseniz

`manifest.json` boş (`[]`) kalırsa login ekranında plaka seçim alanı
hiç görünmez ve oyuncuların isimleri eskisi gibi sade bir yazı
etiketiyle gösterilir — hiçbir şey bozulmaz.

## Not

İlk kaydınız (listedeki ilk eleman) plaka seçmeyen/eski istemcilerle
gelen oyuncular için varsayılan olarak kullanılır.
