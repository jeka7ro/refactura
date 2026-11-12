# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-12 18:52 — Modificare frecvență cron SPV: o singură dată pe zi la ora 09:00
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Modificat programarea automată a cron-ului SPV în `server/spvCron.ts` din rulare la fiecare 4 ore (`0 */4 * * *`) în rulare o singură dată pe zi, dimineața la ora 09:00 (`0 9 * * *`, fus orar `Europe/Bucharest`).
  2. Actualizat textul explicativ din ghidul de pe pagina `/spv` (`client/src/pages/SpvHub.tsx`).
  3. Logica de parsare facturi, arhivare XML și export SAGA rămân 100% neatinse și protejate.
  4. Sincronizarea manuală rămâne accesibilă oricând la cerere din butonul „Sincronizează cu SPV acum”.
- **Fișiere:** `server/spvCron.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `b4d4af0 fix(spv): setare rulare sincronizare cron zilnica la ora 09:00 in loc de 4 ore`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 18:50 — Integrare completă opțiuni SPV, Mediere fiscală online (Ord. 992/2026) și Contract împrumut taxe
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Integrat în noua pagină dedicată `/spv` (`client/src/pages/SpvHub.tsx`) cele 4 secțiuni mari pe tab-uri:
     - 📬 **Mesaje & Recipise SPV**: inbox cu recipise declarații fiscale (D112, D300, D394), notificări de conformare ANAF, decizii și somații, plus modal de înregistrare recipise.
     - 📑 **Facturi e-Factura**: listă completă facturi primite/trimise, buton test live conexiune SPV cu ping și latență ms, sincronizare manuală și reautorizare token OAuth.
     - ⚖️ **Mediere Fiscală Online (Ordin ANAF 992/2026)**: contor dinamic 15 zile de la comunicarea somației, generator formular notificare oficială cu cerere expresă pentru desfășurare prin videoconferință și descărcare/printare.
     - 🤝 **Contract de Împrumut Asociat pentru Plata Obligațiilor Fiscale**: șablon legal conform art. 165 Cod procedură fiscală (salvare directă în biblioteca de contracte a firmei și printare).
  2. Adăugat routerul backend `spvMessages` în `server/routers.ts` cu suport pentru mesaje administrative și recipise SPV.
  3. Adăugat șabloanele oficiale `getTaxLoanTemplate` și `getFiscalMediationNoticeTemplate` în `server/contractTemplates.ts` pentru toate firmele.
  4. Păstrat Jurnal SPV (`/jurnal-spv`, `client/src/pages/SpvLogs.tsx`) și cron-ul SPV (`server/spvCron.ts`) complet neatinse și protejate.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/contractTemplates.ts`, `server/routers.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `4492736 feat(spv): adaugare mesaje recipise SPV, mediere fiscala online si contract imprumut taxe`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori), serverul de dezvoltare servește pagina `/spv` pe portul 3000.

### 2026-11-12 18:10 — Separare clară: Pagină nouă dedicată SPV ANAF (/spv) și păstrare Jurnal SPV intact
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Păstrat fișierul original `client/src/pages/SpvLogs.tsx` și ruta `/jurnal-spv` („Jurnal SPV” din meniul Facturi) 100% intacte și neatinse, exact cum au fost inițial.
  2. Creat fișierul nou complet separat `client/src/pages/SpvHub.tsx` pentru noua pagină dedicată `/spv` (și alias `/spv-anaf`).
  3. Adăugat în sidebar-ul principal secțiunea dedicată „SPV ANAF” cu iconiță proprie, accesibilă separat de Jurnal SPV.
  4. În noua pagină `/spv` au fost integrate toate funcționalitățile noi: buton de test live conexiune SPV cu diagnostic instant (latență în ms, CUI firmă, numărătoare inversă zile valabilitate token OAuth), sincronizare manuală SPV cu toast informativ, buton reautorizare token OAuth, căutare avansată, tab-uri rapide și previzualizare PDF modal.
  5. Cron-ul SPV (`server/spvCron.ts`) și exportul XML SAGA rămân 100% neatinse.
- **Fișiere:** `client/src/pages/SpvHub.tsx` (NOU), `client/src/pages/SpvLogs.tsx` (restaurat intact), `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `server/routers.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `2dc0dca feat(spv): separare pagina noua SPV ANAF (/spv) de Jurnal SPV (/jurnal-spv) pastrat intact`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori client + server).

### 2026-11-12 16:25 — Rezolvare previzualizare NIR în portal contabil și adăugare test conexiune SPV ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Rezolvat eroarea „Documentul nu a fost găsit” la deschiderea PDF-ului de NIR (`NIR-2026-0064` / `SC VBH ROMCOM SRL`) din portalul contabil (`/contabil/woodglass`): `DocumentModalPreview.tsx` atașează automat `accountantToken` (din query URL sau `sessionStorage`) și transmite header-ul `x-accountant-token`; re-hidratare automată a stării `sessionToken` din `sessionStorage` la montarea portalului; adăugat atribut `; Secure` la cookie-ul `accountantSession`.
  2. Adăugat suport multi-secret (`CANDIDATE_SECRETS`) în `server/accountantPortalRouter.ts` pentru validarea uniformă a token-urilor între mediul local și producție (Railway).
  3. Adăugat fallback în `server/fileAuth.ts` și `server/pdfRoute.ts` pentru identificarea NIR-ului după numărul facturii dacă `invoiceArchiveId` nu a fost setat direct la import.
  4. Implementat modul izolat de diagnostic SPV (`server/spvDiagnostic.ts`) și integrat butonul „Testează Conexiunea SPV” cu feedback live (latență în ms, zile valabilitate token, CUI și stare) în ecranul e-Factura SPV din modulul SAGA al portalului contabil și în pagina `/spv-logs`.
  5. Cron-ul de sincronizare SPV (`server/spvCron.ts`) și logica de export SAGA rămân 100% neatinse și protejate.
- **Fișiere:** `client/src/components/DocumentModalPreview.tsx`, `client/src/pages/AccountantPortal.tsx`, `client/src/components/SagaClassicPortalView.tsx`, `client/src/pages/SpvLogs.tsx`, `server/accountantPortalRouter.ts`, `server/spvDiagnostic.ts`, `server/routers.ts`, `server/fileAuth.ts`, `server/pdfRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `7da382a fix(portal): rezolvare previzualizare NIR pentru contabili fara login si adaugare test conexiune SPV`
- **Build / Teste:** `npm run build` trecut cu succes (Vite bundle client + esbuild server bundle `dist/index.js` fără erori). Test curl pe endpoint `/api/pdf/nir/90` validat HTTP 200.

### 2026-11-09 15:45 — Configurare sincronizare continuă Antigravity ↔ Paperclip

