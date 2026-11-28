# 🚗 Spolujazda Piešťany ⇄ Brno (PWA)

Evidencia spolujázd, tankovania a zisku na trase Piešťany ⇄ Brno. Tmavý moderný dizajn, offline-first (`localStorage`), synchronizácia cez Firebase a **automatické jazdy s push notifikáciou** (ako správa z Messengeru).

## Funkcie
- **🧮 Jazda** – smer, dátum, počet pasažierov (0 = idem sám). Každý pasažier má vlastnú kartu: spôsob platby (🏦 účet / 💵 hotovosť / 💱 CZK) a vlastnú sumu. Živý banner s vyzbieranou sumou, rozpis Na účet / Hotovosť / CZK, spotreba auta.
- **⛽ Tankovanie** – suma, litre, €/l (jedno pole sa dopočíta), stanica, tachometer, platba kartou/z účtu vs. hotovosť, OCR bločku (Tesseract.js).
- **📋 História** – filtre, fajky „zaplatené" pri každom pasažierovi, úprava a mazanie.
- **📊 Prehľad** – čistý zisk, prevod na osobný účet (prišlo na účet − tankovanie z účtu − už prevedené), štatistiky, CZK trezor, graf, export/import JSON.
- **🔔 Automatické jazdy** – napr. nedeľa PN ➔ Brno a piatok Brno ➔ PN o 19:00: jazda sa sama pridá do databázy (podľa poslednej jazdy v rovnakom smere) a príde push notifikácia „Chceš v jazde zmeniť údaje?".

## Architektúra
| Časť | Kde |
|---|---|
| Aplikácia (statické súbory) | `index.html`, `css/`, `js/` |
| Dáta | localStorage + Firestore `users/{uid}/items`, `users/{uid}/config/{auto,push}` |
| Prihlásenie | Firebase Auth (meno + heslo, rovnako ako v starej verzii) |
| Push + automatické jazdy | Netlify funkcie `netlify/functions/auto-rides.mjs` (každých 5 min) a `test-push.mjs` |

Staré dáta (kolekcie `trips`, `refuels`, `transfers`) sa pri prvom prihlásení **automaticky prevedú** do nového formátu (nič sa nemaže). Ručne: Prehľad → Účet a cloud → „Načítať staré dáta". JSON záloha zo starej verzie sa dá importovať tiež.

## Nastavenie push notifikácií (jednorazovo)
1. **Nahraj zmeny na GitHub** (`git add -A`, `git commit`, `git push`) – Netlify nasadí aplikáciu aj funkcie.
2. **Služobný účet Firebase:** Firebase konzola → ⚙️ Project settings → *Service accounts* → *Generate new private key* → stiahne sa JSON.
3. **Netlify → Site configuration → Environment variables** pridaj tri premenné (hodnoty sú v lokálnom súbore `netlify-env.local.txt`, ktorý je v `.gitignore`):
   - `FIREBASE_SERVICE_ACCOUNT` = celý obsah stiahnutého JSON súboru
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
4. V Netlify spusti **Deploys → Trigger deploy → Clear cache and deploy site**. Súbor `netlify-env.local.txt` potom zmaž.
5. **Firestore pravidlá** (`firestore.rules`) musia byť publikované vo Firebase konzole (Firestore → Rules).
6. **iPhone:** otvor stránku v Safari → Zdieľať → *Pridať na plochu* → otvor aplikáciu z plochy → prihlás sa → Prehľad → **Zapnúť upozornenia** → **Poslať skúšobnú notifikáciu**. Potom zapni **Pridávať jazdy automaticky**. (Push na iPhone vyžaduje iOS 16.4+ a aplikáciu pridanú na plochu.)

## Lokálne spustenie
`Spustit-Apku.bat` otvorí aplikáciu v okne Edge (bez service workera a push notifikácií). Plnohodnotne: `npx serve .` a otvoriť `http://localhost:3000`.

## Poznámky
- Čas automatických jazdy sa berie v časovej zóne zariadenia (predvolene Europe/Bratislava), letný/zimný čas sa rieši automaticky.
- Funkcia beží každých 5 minút, notifikácia teda príde medzi 19:00 a 19:05.
- Prihlasovacie meno `admin` s heslom `admin` je verejne uhádnuteľné – zmeň si heslo vo Firebase konzole (Authentication → Users) alebo si vytvor vlastný účet.
