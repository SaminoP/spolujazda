# 🚗 Spolujazda Piešťany ⇄ Brno (PWA pre iPhone & Web)

Moderná aplikácia pre evidenciu nákladov, tankovania a zisku zo spolujázd na trase Piešťany – Brno a späť. Navrhnutá v štýle iOS s podporou offline režimu, synchronizácie cez Google Firebase Cloud a automatického nasadzovania cez GitHub & Netlify.

## 📱 Funkcie aplikácie

1. **Trasa a fixná vzdialenosť:**
   - `PN ➔ Brno` (150 km fixne)
   - `Brno ➔ PN` (150 km fixne)
2. **Pasažieri a vyzbierané peniaze:**
   - Štandardný počet pasažierov s automatickým výpočtom sumy (predvolene 7.50 € / osoba)
   - **Voliteľná možnosť: Ísť bez pasažierov** (0 ľudí, 0 € zisk)
   - **Voliteľná kolonka pre pasažierov s nižšou sumou** (napr. skoršie vysadenie po trase v Novom Meste, Uherskom Hradišti)
3. **Evidencia tankovania:**
   - Samostatná záložka na evidenciu tankovania s automatickým dopočítaním ceny za liter / litrov
   - Sledovanie stavu tachometra a názvu čerpacej stanice
4. **História s možnosťou úprav:**
   - Prehľad jázd aj tankovaní
   - Možnosť spätnej editácie (`✏️ Upraviť`) pri preklepe v cene, dátume alebo počte pasažierov
   - Možnosť zmazania záznamov
5. **Peňaženka a štatistiky:**
   - Čistý zisk (Vyzbierané od ľudí − Skutočné tankovania)
   - Štatistika najazdených km, priemerná cena paliva na liter, počet prevezených ľudí
6. **Autentifikácia a Cloudová synchronizácia:**
   - Prihlásenie vlastným menom a heslom (testovací účet: `admin` / `admin`)
   - Google Firebase Firestore pre prístup k vlastným dátam z akéhokoľvek zariadenia v reálnom čase
   - Automatický lokálny offline režim
