# Merge Racers

Offline idle merge igra za Android (radni naziv). Kupuj aute, spajaj dva ista u viši nivo, auta voze petlju i zarađuju coine.

- Potpuno offline, portret, igra se jednom rukom (samo dodir)
- Stack isti kao `merge-defense`: HTML5 canvas + vanilla JS u Capacitor omotaču, bez eksternih servisa
- Sva grafika i zvuk su generisani kodom (15 dizajna auta, 2 staze, WebAudio muzika i efekti)

## Kako se igra

- **Buy** kupuje auto (cijena raste). Prevuci auto na isti auto da ih spojiš (do nivoa 15).
- Svaki krug auta donosi coine srazmjerno nivou. Auta voze i dok je igra zatvorena (offline zarada do 4 h, rewarded x2).
- **Tracks**: otključaj novu stazu coinima, svaka ima veći multiplikator.
- **Prestige**: kad dosegneš auto nivoa 12, resetuješ aute i coine za trajni bonus (zvjezdice).
- **Turbo** (x2 brzina 60 s), **Free car** i **x2 offline** su rewarded dugmad (za sada simulirana).

## Pokretanje lokalno

```
npm install
npm start          # http://localhost:8080 (u Chromeu uključi mobile emulaciju, portret)
npm run sim        # balans test (ekonomija, prestige, pravila spajanja)
```

Ili samo otvori `www/index.html` kroz bilo koji statički server.

## Izgradnja APK-a

Svaki push na GitHub pokreće **Actions → Build APK**:

1. Otvori run → **Artifacts** → skini `merge-racers-apk` → unutra je `merge-racers.apk`.
2. Na `main` se APK dodatno objavi u **Releases**; na ostalim granama kao dev prerelease (druga aplikacija `...dev`, svoje spremljene podatke).
3. `keystore/debug.keystore` je fiksni DEBUG ključ (nove verzije se instaliraju preko starih). Nije za Play Store, za objavu napravi pravi release ključ.

Ručno: `npm ci && npx cap add android && npx cap sync android`, pa `./gradlew assembleDebug -I ../android-signing.gradle` u `android/` (isti koraci kao u `.github/workflows/build-apk.yml`).

## Gdje su postavke i fajlovi

| Šta | Gdje |
|---|---|
| Postavke u igri (muzika, efekti, vibracija, reset) | ikona zupčanika gore desno |
| Balans (cijene, zarada, prestige, offline, trajanje reklama) | `www/config.js` |
| Svi tekstovi (UI je na engleskom, jedan fajl za prevod) | `www/strings.js` |
| Rewarded reklame (jedini modul koji zna za reklame) | `www/adservice.js` |
| Logika igre (bez DOM-a) | `www/core.js` |
| Crtanje auta, staza, ikona | `www/render.js` |
| Petlja igre, unos, UI | `www/main.js` |
| Zvuk i vibracija | `www/audio.js` |
| Balans simulacija | `tools/sim.js` |

Napredak se sprema lokalno (`localStorage`, ključ `mr_save_v1`): coini, auta, staze, prestige, postavke, najbolji rezultat.

## AdMob kasnije

Sada `AdService` simulira reklamu (odbrojavanje na dugmetu, nagrada, cooldown). Za pravi AdMob zamijeni provider i ništa drugo ne diraj:

```js
AdService.setProvider({
  show(placement, onReward, onFail) {
    // prikaži rewarded video; kad korisnik zaradi nagradu pozovi onReward(), ako ne uspije onFail()
  }
});
```

Mjesta (placement): `turbo`, `freecar`, `offline`.

## Treća staza

`config.js` ima zakomentarisan unos za planine. Za uključivanje: dodaj temu `mountain` u `THEMES` u `render.js`, naziv u `strings.js` (`trackNames`) i odkomentariši unos.
