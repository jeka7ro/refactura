# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-12 16:25 — Rezolvare previzualizare NIR în portal contabil și adăugare test conexiune SPV ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Rezolvat eroarea „Documentul nu a fost găsit” la deschiderea PDF-ului de NIR (`NIR-2026-0064` / `SC VBH ROMCOM SRL`) din portalul contabil (`/contabil/woodglass`): `DocumentModalPreview.tsx` atașează automat `accountantToken` (din query URL sau `sessionStorage`) și transmite header-ul `x-accountant-token`; re-hidratare automată a stării `sessionToken` din `sessionStorage` la montarea portalului; adăugat atribut `; Secure` la cookie-ul `accountantSession`.
  2. Adăugat suport multi-secret (`CANDIDATE_SECRETS`) în `server/accountantPortalRouter.ts` pentru validarea uniformă a token-urilor între mediul local și producție (Railway).
  3. Adăugat fallback în `server/fileAuth.ts` și `server/pdfRoute.ts` pentru identificarea NIR-ului după numărul facturii dacă `invoiceArchiveId` nu a fost setat direct la import.
  4. Implementat modul izolat de diagnostic SPV (`server/spvDiagnostic.ts`) și integrat butonul „Testează Conexiunea SPV” cu feedback live (latență în ms, zile valabilitate token, CUI și stare) în ecranul e-Factura SPV din modulul SAGA al portalului contabil și în pagina `/spv-logs`.
  5. Cron-ul de sincronizare SPV (`server/spvCron.ts`) și logica de export SAGA rămân 100% neatinse și protejate.
- **Fișiere:** `client/src/components/DocumentModalPreview.tsx`, `client/src/pages/AccountantPortal.tsx`, `client/src/components/SagaClassicPortalView.tsx`, `client/src/pages/SpvLogs.tsx`, `server/accountantPortalRouter.ts`, `server/spvDiagnostic.ts`, `server/routers.ts`, `server/fileAuth.ts`, `server/pdfRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `c1643f5 fix(portal): rezolvare previzualizare NIR pentru contabili fara login si adaugare test conexiune SPV`
- **Build / Teste:** `npm run build` trecut cu succes (Vite bundle client + esbuild server bundle `dist/index.js` fără erori). Test curl pe endpoint `/api/pdf/nir/90` validat HTTP 200.
- **Autor:** Antigravity
- **Ce s-a făcut:** Inițializare mecanism de sincronizare continuă între sesiunile locale Antigravity (Mac) și sesiunile la distanță Paperclip. Stare git la inițializare: arbore curat (`git status --short` curat), ultimul commit local fiind `d7e1cc6` (implementare navigare separată pe clienți și furnizori cu fișă partener, situație centralizată și detalii poziții în modul SAGA al contabilului).
- **Fișiere:** `.agents/rules/paperclip-sync.md`, `.agents/rules/project-rules.md`, `.agents/AGENTS.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `d7e1cc6 feat(accountant-portal): adaugare navigare separata pe clienti si furnizori cu fisa partener, situatie centralizata si detalii linii`
- **Build / Teste:** `npm run build` trecut cu succes (bundle de producție `dist/index.js` și asset-urile frontend generate fără erori).

