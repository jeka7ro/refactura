# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-12 18:05 — Pagină separată dedicată SPV ANAF (/spv) cu test live conexiune și inbox mesaje
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Creat pagina complet separată și dedicată SPV ANAF accesibilă direct la `/spv` (cu alias-uri `/spv-anaf` și `/jurnal-spv`).
  2. Adăugat element dedicat de navigare directă în meniul principal (sidebar): „SPV ANAF” cu iconiță dedicată și acces dintr-un singur click.
  3. Integrat buton live de test conexiune SPV ANAF cu diagnostic în timp real (latență server în ms, numărătoare inversă zile valabilitate token OAuth, CUI firmă și mesaj oficial ANAF).
  4. Integrat buton de sincronizare manuală SPV („Sincronizează cu SPV acum”) și buton de reautorizare token OAuth.
  5. Implementat tab-uri rapide (Toate, Primite, Trimise, Erori ANAF), căutare avansată după număr factură, CUI, partener și index SPV, copiere rapidă index SPV și CUI.
  6. Integrat modal de previzualizare PDF factură direct din tabel prin `DocumentModalPreview`.
  7. Nucleul SPV (`server/spvCron.ts`) și exportul XML SAGA au rămas 100% neatinse.
- **Fișiere:** `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/SpvLogs.tsx`, `server/routers.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `891517c feat(spv): adaugare pagina dedicata SPV ANAF (/spv) cu test live conexiune si jurnal complet mesaje`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori pe client Vite și server `dist/index.js`).

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

