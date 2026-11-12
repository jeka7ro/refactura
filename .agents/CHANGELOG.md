# Jurnal de modificări (Antigravity ↔ Paperclip)

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

