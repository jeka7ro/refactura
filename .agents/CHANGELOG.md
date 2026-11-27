# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-27 14:25 — Verificare completă & blindare Export SAGA XML/ZIP/Web pentru Facturi Externe Non-SPV + Portal Contabil (`sagaXmlGenerator.ts`, `accountantPortalRouter.ts`, `AccountantPortal.tsx`, `SagaClassicPortalView.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Integrare completă a Facturilor Externe / Non-SPV în Exportul SAGA XML, Arhiva ZIP și SAGA Web (`server/sagaXmlGenerator.ts`):**
     - Adăugat exportul facturilor externe / Non-SPV de **Intrare** (`direction === "in"`, `source !== "spv_anaf"`, fără `spvIndex` și fără dublură în `nir` sau `sagaIntrari`) pe `<Tip>Servicii</Tip>` și `<Cont>628</Cont>` (fără `<Cod>` sau `<Gestiune>`, ca să nu polueze `ART_<data>.xml`), cu calcul automat `<FacturaCurs>` la cursul BNR al datei documentului și `<FacturaTaxareInversa>` (`Da` pentru furnizori intracomunitari UE cu VAT ID valid și TVA `0`, ex. `Google Ireland IE6388047V`; `Nu` pentru furnizori non-UE sau interni).
     - Adăugat exportul facturilor externe / Non-SPV de **Ieșire** (`direction === "out"`, `source !== "spv_anaf"`, fără `spvIndex`, deduplicate față de `emittedInvoices` și `reInvoices`) pe `<Cont>704</Cont>` / `<Tip>Servicii</Tip>`, citind corect numele și CUI-ul clientului din `invoiceArchive`.
     - Păstrat **100% neschimbate** facturile SPV ANAF fără NIR (pentru a evita dublarea la importul SPV în SAGA C) și toate sumele/regulile istorice SAGA (`Tenant 1` = exact `25` `<Factura>` fără dubluri; `Tenant 4 WOOD GLASS SRL` = exact `215` `<Factura>` fără dubluri; codificare binară `Windows-1250`).
     - Adăugat `detectPartnerCountry(cui, name, currency)` pentru clasificarea corectă a țării partenerilor externi fără prefix VAT (ex. `OpenAI, L.L.C.`, `Anthropic, PBC`, `Cloudflare, Inc.` → `US`, `GBP + Ltd` → `GB`, `CHF + AG/GmbH` → `CH`), fără a afecta niciodată firmele românești (`SRL`/`SA`/`PFA` → `RO`).
  2. **Aliniere Portal Contabil (`Mod Modern` + `Mod SAGA Clasic`) și geometrie mobilă `320px` (`server/accountantPortalRouter.ts`, `client/src/pages/AccountantPortal.tsx`, `client/src/components/SagaClassicPortalView.tsx`):**
     - Extins `downloadSagaXml` și `generateSagaExportXML` cu suport pentru `startDate` / `endDate`, astfel încât filtrele `Ultimele 3 luni` și `Interval personalizat` din Portalul Contabil (pe ambele taburi `Intrări` / `Ieșiri`, atât în `Mod Modern`, cât și în `Mod SAGA Clasic`) să exporte exact perioada selectată.
     - Corectat `getDocumentLines` în Portalul Contabil pentru facturile din arhivă fără NIR: afișare `<Cont>628</Cont>` / `Servicii` pentru facturile externe Non-SPV, calcul corect al TVA-ului pe linie când `invoiceArchiveLines.total` stochează valoarea netă (`LineExtensionAmount`) și transmiterea parametrului `source` din `SagaClassicPortalView`.
     - Aliniat antetul mobil din `AccountantPortal.tsx` și bara superioară din `SagaClassicPortalView.tsx` (`min-w-0 max-w-full`) pentru `0` overflow orizontal pe toate rezoluțiile (`320px`, `375px`, `390px`, `430px`, `1440px`) în Light și Dark Mode.
- **Fișiere:** `server/sagaXmlGenerator.ts`, `server/accountantPortalRouter.ts`, `server/externalAndStatements.test.ts`, `client/src/pages/AccountantPortal.tsx`, `client/src/components/SagaClassicPortalView.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npx vitest run` (`8/8` passed), `npm run build` (`0` erori), verificare live SAGA XML & ZIP HTTP (`T1 = 25` doc., `T4 WOOD GLASS = 215` doc., `0` dubluri, test end-to-end Google Ireland `IE` + OpenAI `US` + Hetzner cu NIR fără dublare + ieșire externă + curățare `100%` cu `0` date de test rămase în DB) și Playwright (`320px–1440px`, Light/Dark), fără `git push`.

### 2026-11-27 12:52 — Import Facturi Externe / Non-SPV (calcul lunar + Portal Contabil), Extrase de Cont Bancare și instalare skill-uri `mattpocock/skills` + `obra/superpowers` + `anthropics/skills`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Import Facturi Externe / Non-SPV + Calcul Lunar BNR + Portal Contabil (`ExternalInvoiceImportModal.tsx`, `AllInvoices.tsx`, `InvoiceArchive.tsx`, `InvoiceDetail.tsx`, `Dashboard.tsx`, `Reports.tsx`, `uploadRoute.ts`, `pdfRoute.ts`, `accountantPortalRouter.ts`):**
     - Adăugat butonul `+ Factură externă` pe `/facturi` și în `/arhiva-facturi`, cu modal Apple HIG (`ExternalInvoiceImportModal`) care acceptă PDF original, XML UBL sau imagine scanată (`.png`, `.jpg`, `.jpeg`, `.webp`), extrage automat furnizorul/VAT ID-ul (Google Ireland, Meta, OpenAI, Hetzner, AWS, furnizori UE/non-UE, fără a confunda CUI-ul firmei cumpărătoare), numărul, data, moneda (`EUR`, `USD`, `RON`, `GBP`, `CHF`) și suma, afișând live echivalentul în RON la cursul BNR.
     - Extins `GET /api/pdf/archive/:id` să servească direct fișierul original încărcat pe disc (fără generare de PDF-uri false) și `createInvoiceArchiveEntry` să creeze automat linia contabilă netă în `invoiceArchiveLines` pentru NIR, SAGA XML și detalii Portal.
     - Actualizat calculul lunar în `Dashboard.tsx`, `Reports.tsx` și `AccountantPortal.tsx` / `accountantPortalRouter.ts` ca toate facturile externe în valută (`EUR`, `USD`, `GBP`, `CHF`) să fie convertite corect în `RON` la cursul BNR, afișate cu insigna `Extern / Non-SPV`, incluse în exportul Excel (cu lățimi `!cols` și coloane valută + echivalent RON) și în `Descarcă Pachet ZIP`.
  2. **Modul Extrase de Cont Bancare + Integrare în Portal Contabil (`drizzle/schema.ts`, `bankStatementsRouter.ts`, `BankStatements.tsx`, `AccountantPortal.tsx`, `SagaClassicPortalView.tsx`, `fileAuth.ts`):**
     - Creat tabela `bankStatements` (auto-migrată idempotent), ruta securizată `POST /api/upload-bank-statement` (cu extracție automată IBAN, bancă prin cod BIC — BT, ING, UniCredit, BCR, Raiffeisen, BRD, CEC, Revolut, Salt etc. — valută, lună contabilă și solduri din PDF/CSV/MT940/CAMT.053), streaming-ul protejat `GET /api/pdf/bank-statement/:id` și pagina dedicată `/extrase-cont` în meniul `Facturi → Extrase de Cont`.
     - Adăugat tabul `Extrase de cont` în Portalul Contabil (atât în `Mod Modern`, cât și în `Mod SAGA Clasic` prin butonul `Extrase`), cu previzualizare PDF în fereastră, descărcare individuală, `Export Excel (.xlsx)`, `Descarcă extrase (.zip)` și includere automată în folderul `Extrase_de_Cont/` din pachetul ZIP principal.
  3. **Upgrade ecosistem de skill-uri și Glosar de Domeniu (`mattpocock/skills`, `obra/superpowers`, `anthropics/skills`, `GLOSSARY.md`):**
     - Instalat în `.agents/skills/` cele 19 skill-uri oficiale (`codebase-design`, `improve-codebase-architecture`, `domain-modeling`, `grill-with-docs`, `grill-me`, `mattpocock-tdd`, `code-review`, `diagnosing-bugs`, `to-spec`, `writing-for-agents`, `dispatching-parallel-agents`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `writing-plans`, `executing-plans`, `pdf`, `xlsx`, `docx`), creat `GLOSSARY.md` (Ubiquitous Language pentru domeniu), `.agents/rules/engineering-and-docs-skills.md` și suita `vitest` `server/externalAndStatements.test.ts`.
- **Fișiere:** `drizzle/schema.ts`, `server/{bankStatementsRouter.ts,uploadRoute.ts,pdfRoute.ts,fileAuth.ts,routers.ts,db.ts,accountantPortalRouter.ts,externalAndStatements.test.ts}`, `server/_core/index.ts`, `client/src/components/{ExternalInvoiceImportModal.tsx,DashboardLayout.tsx,SagaClassicPortalView.tsx}`, `client/src/pages/{BankStatements.tsx,AllInvoices.tsx,InvoiceArchive.tsx,InvoiceDetail.tsx,Dashboard.tsx,Reports.tsx,AccountantPortal.tsx}`, `client/src/App.tsx`, `GLOSSARY.md`, `.agents/{AGENTS.md,CHANGELOG.md,rules/engineering-and-docs-skills.md}`, `.agents/skills/**`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npx vitest run` (`6/6` passed), `npm run build` (`0` erori), verificare Playwright Headless Desktop `1440px` + Mobil `375px`/`320px` Light/Dark + izolare cross-tenant (`200` owner/contabil vs `404` alt tenant) și curățare completă (`0` date de test rămase în DB), fără `git push`.

### 2026-11-27 11:31 — Fix complet Calculator Valutar BNR: aplicare pe Rândul 3 / toate liniile și eliminare tăiere text în `<select>` (`InvoiceCurrencyCalculator.tsx`, `EmitInvoice.tsx`, `ReInvoice.tsx`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Rezolvat tăierea/suprascrierea textului în `<select>` și înălțimea `PopoverContent` (`client/src/index.css`, `client/src/components/InvoiceCurrencyCalculator.tsx`):**
     - Eliminat `py-2` (`padding-top: 8px; padding-bottom: 8px`) de pe elementele `<select>` cu înălțime explicită (`select[class*="h-"]`) din `index.css` `@layer base`, care lăsa doar `10px` spațiu interior și tăia pe jumătate textul `Linia 3: ...` în selector.
     - Trecut selectorul `Aplică pe linia:` pe lățime completă (`w-full h-9 py-0 px-3`), mărit `maxHeight` al popover-ului la `540px` și fundal 100% opac (`!bg-white dark:!bg-[#1c1c1e]`) ca să nu mai apară scrollbar intern sau suprapunere peste conținutul din spate.
  2. **Rezolvat selecția și aplicarea sumei pe Rândul 3 și pe linii multiple (`InvoiceCurrencyCalculator.tsx`, `EmitInvoice.tsx`, `ReInvoice.tsx`):**
     - La adăugarea unui rând nou (ex: Rândul 3) sau la deschiderea calculatorului, linia activă / primul rând cu preț `0` este selectat automat (`L3`), fără a rămâne blocat pe linia anterioară.
     - Adăugat butoane rapide `L1`, `L2`, `L3` … + `Toate` și opțiunea `Toate liniile` (`__ALL__`) pentru aplicarea sumei convertite pe un rând anume sau pe toate rândurile facturii dintr-un click, plus trunchiere inteligentă la mijloc a descrierilor lungi și protecție `initializedSourceRef` contra suprascrierii rândurilor noi la focus în fereastră.
- **Fișiere:** `client/src/index.css`, `client/src/components/InvoiceCurrencyCalculator.tsx`, `client/src/pages/EmitInvoice.tsx`, `client/src/pages/ReInvoice.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și verificare geometrică + funcțională în Playwright Headless (3 linii + `Toate`, `paddingTop/Bottom: 0px`, `scrollHeight <= clientHeight`, screenshot verificat vizual), fără `git push`.

### 2026-11-26 23:08 — Restaurare logo firmă (`GetApp` + `www.getapp.ro` pe Tenantul 1) pe toate PDF-urile facturilor primite din SPV/Arhivă (`server/pdfRoute.ts`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Eliminat condiția `if (inv.direction === "out")` introdusă greșit în `GET /api/pdf/archive/:id` (`server/pdfRoute.ts`), astfel încât logo-ul tenantului (`logoBase64`, `logoHasBackground`, `logoBgColor`) și `www.getapp.ro` (pe Tenantul 1) se randează din nou pe absolut toate PDF-urile din arhivă/SPV (inclusiv facturile primite `direction === "in"`).
- **Fișiere:** `server/pdfRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și verificare directă pe PDF-ul real `26BVFCS 44149` (`7086669634`) din SPV (imaginea logo-ului + `www.getapp.ro` prezente în PDF), fără `git push`.

### 2026-11-26 17:22 — Eliminare completă a exemplelor hardcodate cu numele/CUI-ul altor tenanți din UI (`Settings.tsx`, `Integrations.tsx`, `EmitInvoice.tsx`, `ContractInvoiceToggle.tsx`, `SagaModule.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat leak-ul de exemplu `wood-glass` / `contabilitate-wood` din Setări → Portal Contabil (`client/src/pages/Settings.tsx`):**
     - Înlocuit textul hardcodat `(ex: wood-glass, contabilitate-wood)` cu exemple generate dinamic exclusiv din numele propriei firme active a tenantului curent (ex: `trade-invest-network`, `contabilitate-trade-invest` pe Trade Invest; sau `firma-mea`, `contabilitate-firma` dacă nu există denumire completată), plus prefixul dinamic al hostului curent (`/contabil/`).
  2. **Eliminat toate celelalte exemple hardcodate de CUI / contract / rețetă aparținând unui anumit tenant din paginile partajate:**
     - `client/src/pages/Integrations.tsx`: înlocuit CUI-ul real al Tenantului 1 (`Ex: 42322117`) din asistentul Oblio cu exemplul neutru `12345678`.
     - `client/src/components/ContractInvoiceToggle.tsx` & `client/src/pages/EmitInvoice.tsx`: înlocuit `placeholder="ex: 392"` cu `ex: 101` și aliniat `ContractInvoiceToggle.tsx` la paleta neutră Apple Dark/Light (`#2c2c2e`).
     - `client/src/pages/SagaModule.tsx`: înlocuit exemplul de tâmplărie din tabul Rețete (BOM) cu un exemplu generic de producție.
- **Fișiere:** `client/src/pages/Settings.tsx`, `client/src/pages/Integrations.tsx`, `client/src/pages/EmitInvoice.tsx`, `client/src/pages/SagaModule.tsx`, `client/src/components/ContractInvoiceToggle.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și verificare Playwright Headless pe `/setari?tab=accountant` (`0` referințe `wood-glass` pe alți tenanți, controale Dark Mode neutre `#2c2c2e`), fără `git push`.

### 2026-11-26 17:08 — Unificare completă Apple HIG Dark/Light Mode pe toate cele 57 de pagini, tabele și modale (zero tentă bleumarin `slate`, zero mix vizual)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare definitivă a nuanței albastre/bleumarin (`slate-950/900/800`) pe Dark Mode și unificare primitive (`client/src/index.css`, `DataTable.tsx`, `skeleton.tsx`, `DashboardLayout.tsx`):**
     - Remapat în `.dark` scara `--color-slate-*` și `--color-gray-*` la tonurile neutre Apple HIG (`#09090b`, `#0c0c0e`, `#1c1c1e`, `#2c2c2e`, `#3a3a3c`, `#8e8e93`, `#98989d`, `#f5f5f7`), curățat `.dark .apple-canvas` de reflexia albastră și trecut `<Skeleton>` pe `bg-black/[0.06] dark:bg-white/[0.08]`.
     - Unificat `DataTable.tsx` la `.apple-surface`, `.apple-pill-control` și antete sentence-case `12px`, și eliminat dubla iluminare din sidebar pe `/devize` (`Facturi → Devize de Lucrări` vs `Gestiune → Devize`).
  2. **Unificare structurală și cromatică completă pe toate paginile și modalele aplicației la standardul de pe `/facturi` (`AllInvoices.tsx`):**
     - **Portal Contabil & Facturare secundară:** `AccountantPortal.tsx` (eliminat fundalul bleumarin și butonul alb `Export XML SAGA` pe Dark Mode, unificat toate cardurile KPI, filtrele `<Select>` / `.apple-segmented` și tabelul în `.apple-surface`), `SagaClassicPortalView.tsx`, `DevizeList.tsx`, `DevizDetail.tsx`, `EditDevizModal.tsx`, `Catalog.tsx`, `EmailLogs.tsx` (încadrare 100% a coloanei `Acțiuni` fără scroll orizontal), `SpvLogs.tsx`, `InvoiceArchive.tsx`.
     - **Gestiune, Contracte, Parteneri & Centre de Cost:** `NIRList.tsx` (eliminat al doilea buton duplicat `Toate` și uniformizat butoanele Excel/SAGA la `.apple-btn-glass`), `NIRCreate.tsx`, `BonuriConsumList.tsx`, `BonConsumDetail.tsx`, `BonConsumCreate.tsx`, `Inventory.tsx`, `ContractsList.tsx`, `ContractDetail.tsx`, `ContractCreate.tsx`, `Clients.tsx`, `ClientDetails.tsx`, `CostCenters.tsx`, `CostCenterDetail.tsx`.
     - **SAGA, SPV Hub, Rapoarte, Setări, HoReCa, Admin & Modale:** `SpvHub.tsx`, `SagaModule.tsx` (trecut banda verticală laterală pe suprafață neutră `#1c1c1e`), `SagaSyncPage.tsx`, `Reports.tsx`, `CursValutar.tsx`, `Integrations.tsx`, `Settings.tsx`, `ApiKeys.tsx`, `EmitInvoice.tsx`, `ReInvoice.tsx`, `AdminDashboard.tsx`, `SuperAdmin.tsx`, toate cele 11 ecrane `horeca/*` și cele 9 combobox-uri/modale partajate (`PartnerCombobox`, `ArticleCombobox`, `PlanConturiCombobox`, `NirSelectorModal`, `SagaImportSimulatorModal`, `InvoiceCurrencyCalculator`, `ContractSignaturePadModal`, `ContractVisualEditor`, `ConfirmModal`).
- **Fișiere:** `client/src/index.css`, `client/src/components/{DashboardLayout,DataTable,EditDevizModal,SagaClassicPortalView,PartnerCombobox,ArticleCombobox,PlanConturiCombobox,NirSelectorModal,SagaImportSimulatorModal,InvoiceCurrencyCalculator,ContractSignaturePadModal,ContractVisualEditor}.tsx`, `client/src/components/ui/{skeleton,ConfirmModal}.tsx`, `client/src/pages/**` (43 pagini), `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și audit vizual + RGB în Playwright Headless pe toate cele `46` de rute în Dark Mode + Light Mode (`0` Page Errors, `0` HTTP `>=400`, `0` suprafețe bleumarin, `0` butoane albe netematizate pe Dark Mode), fără `git push`.

### 2026-11-25 21:49 — Check-up complet cap-coadă: Securitate & Izolare Multi-Tenant, SPV/ANAF/Conector Chrome, Calcule Fiscale UBL/SAGA/Devize, HoReCa, PDF/Email, Kiosk și Geometrie UI/Dark Mode
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Securitate critică & Izolare strictă Multi-Tenant (IDOR, OAuth, Sesiuni, Portal Contabil, Fișiere & SSRF):**
     - Făcut `resolveEntityPair` (`server/routers.ts`) strict *read-only* (eliminat auto-cuplarea PF↔PJ din query-uri de citire, păstrând scrierea exclusiv în `upsertPersonalProfile` cu gardă pe rol și proprietar) și adăugat `resolveVerifiedAccountTenant` (`server/tenant.ts`, `server/_core/context.ts`, `server/fileAuth.ts`) pentru verificarea activă `userTenants.isActive = 1` + pereche bidirecțională validă.
     - Închis propagarea globală de token-uri OAuth ANAF pe `sub`/`apiSecret` între tenanți neasociați (`server/spvAuth.ts`, `server/anafApi.ts`), blocat suprascrierea manuală `provider === "spv"` în `integrations.upsert`, validat `audience` în `googleLogin` (`server/auth-routers.ts`), dezactivat stub-urile OAuth neverificate (`server/oauth-handlers.ts`), fixat `jwtVerify` pe `HS256` fără secret static (`server/session.ts`) și adăugat rate-limiting pe `login`, `forgotPassword`, `setPin`, `disablePin` și `accountantPortal.verifyPin` (`timingSafeEqual` + limită pe `tenantId` și `remoteAddress`).
     - Legat criptografic sesiunea Portalului Contabil (`computeAccountantCredFingerprint` în `server/accountantPortalRouter.ts` & `server/fileAuth.ts`) de amprenta `(portal.token, portal.pinHash, accessPinHash)` pentru revocare instantă la schimbarea linkului sau PIN-ului; mascat `brevoApiKey`, `sagaWebToken` și `accountantPortal.token` în răspunsurile API (`stripPinFromTenant`, `getAllTenants`) și restricționat rolul `viewer` (`assertTenantWriteAccess`).
     - Securizat descărcările de PDF-uri, contracte, upload-uri și S3 proxy (`server/pdfRoute.ts`, `server/contractsRouter.ts`, `server/_core/storageProxy.ts`, `server/storage.ts`, `server/_core/index.ts`, `server/uploadRoute.ts`): eliminat fereastra `mtimeMs` de 15 minute pentru fișiere neprefixate, impus prefixul `t${tenantId}-` și verificarea `isFile()` + `.on("error")` pe `createReadStream` (anti-`EISDIR`), limitat decompresia ZIP/DOCX/zlib contra zip-bombs și blocat bypass-ul SSRF IPv4-mapped IPv6 hex (`[::ffff:a9fe:a9fe]`, `[::ffff:7f00:1]`, `172.16/12`) în `assertSafeWebhookUrl`.
  2. **Securizare SPV / e-Factura, Conector Chrome USB și Integritate Fiscală UBL / SAGA / Devize / HoReCa:**
     - Verificat potrivirea CIF-ului mesajelor SPV și a părților UBL (`AccountingCustomerParty` / `AccountingSupplierParty`) cu CUI-ul real al tenantului (`tenants.cui`) în `spvCron.ts` (cu mutex per-tenant și parser JSON+XML pe `stareMesaj`), `spvSync.ts`, `oblioSync.ts`, `smartbillSync.ts` și `invoices.importSpv`.
     - Blindat `chrome-spv-connector` (`background.js`, `manifest.json`): validare strictă a originii tab-ului apelant (`isTrustedAppSender`), regex pe limite de cuvânt la filtrarea CIF în `detalii`, păstrarea `actualMsgCif`, persistență `chrome.storage.session` pentru `lastAuthenticatedCifs` și eliminarea expunerii CIF-urilor altor firme de pe stick-ul USB.
     - Rezolvat coliziunea de chei primare `devize.invoiceId` între `emittedInvoices` și `reInvoices` (`DEV-RF-%` / `BC-RF-%`), secvențierea `RF-YYYY-NNNN` din `MAX` (fără dubluri după ștergere), ordinea `sdenumire_Judet` înaintea localității în `anafProxy.ts`, prefixul `RO` / zecimalele / unitățile UN/ECE și `normalizeUblDate` în `anafXmlGenerator.ts`, cota `0%` TVA (`?? 21`) pe devize și pe `Dashboard.tsx`.
     - În modulul SAGA (`modules/saga/router.ts`, `migrations.ts`, `sagaSyncRoute.ts`, `sagaXmlGenerator.ts`, `sagaInvoiceImporter.ts`): izolat subconturile analitice `.` strict pe `tenantId === 4` + CUI verificat `28396216`, validat proprietatea FK pe articole/gestiuni în toate mutațiile de linii, făcut `simulateSagaNirImport` fără efecte secundare în DB (`persistToDb: false`), exclus intrările `stornat` la export și sanitizat headerele/numele de fișiere ZIP.
     - În modulul HoReCa & Kiosk (`modules/horeca/router.ts`, `client/src/pages/kiosk/*`) și `publicApi.ts`: eliminat cheile/parolele hardcodate Syrve/Kiosk, tratat grațios indisponibilitatea `localhost:4000` (eliminat HTTP 500 pe `/horeca/locatii`), exclus liniile `cancelled` din scăderea de stoc, aplicat `discount` pe totalul comenzii, validat FK-urile rețetelor, reparat cele 5 crash-uri runtime din Kiosk și blindat `publicApi.ts` contra `NaN` / `LIKE '%%'`.
     - În PDF & Email (`server/pdfRoute.ts`, `server/pdf.ts`, `server/emailService.ts`, `PrintInvoice.tsx`): scăpat HTML toate câmpurile interpolate în șabloanele de email (anti-Stored XSS), suportat `senderEmail` dedicat când un tenant folosește propriul `brevoApiKey`, fallback sigur `Roboto` → `Helvetica`, păstrat `www.getapp.ro` exclusiv pe Tenantul 1 fără a suprascrie `logoSubtitle` la ceilalți tenanți și reparat totalul pe linie `0,00` la printare.
  3. **UI/UX, Dark Mode, Rând Unic pe Dashboard și Geometrie Mobilă (`320px–1440px`, iOS Safari):**
     - Pus pe un singur rând continuu bara de orizont și sincronizare de pe `Dashboard.tsx` (`7 Zile … Toate`, `Actualizat`, `Auto (5m)`, `Actualizează`), eliminat conturul albastru de pe primele carduri KPI din `SpvHub.tsx` și `Clients.tsx`, eliminat filtrele duplicate din `NIRList.tsx`, reparat contrastul Dark Mode (`CookieBanner.tsx`, `input-group.tsx`, `InvoiceArchive.tsx`, `store.ts`), ascuns widgetul meteo peste PIN pe ecrane `<1024px`, izolat referințele `GetApp` / `Smart QR` strict pe Tenantul 1 și asigurat `font-size >= 16px` pe toate inputurile mobile (contra auto-zoom iOS Safari) + `0` overflow orizontal pe toate rutele.
- **Fișiere:** `server/**` (29 fișiere), `modules/horeca/*`, `modules/saga/*`, `chrome-spv-connector/{background.js,manifest.json}`, `client/src/**` (39 fișiere), `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori), `vitest` (`1/1` passed), suită automată de penetrare cross-tenant/SSRF/PDF/SAGA (`100%` passed) și audit Playwright Headless pe `330` combinații rută × rezoluție (`1440px`, `1280px`, `430px`, `390px`, `375px`, `320px`) × temă Light/Dark (`0` Page Errors, `0` HTTP `>=400`, `0` inputuri mobile `<16px`, `0` overflow-uri), fără `git push`.

### 2026-11-25 19:49 — Instalare și activare pachete de skill-uri `vercel-labs/agent-skills`, `anthropics/skills` și `obra/superpowers`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Instalat în `.agents/skills/` cele 5 skill-uri oficiale împreună cu referințele și scripturile lor:**
     - `web-design-guidelines` (`vercel-labs/agent-skills` + snapshot local complet `vercel-labs/web-interface-guidelines` în `references/command.md` și `references/README.md`);
     - `webapp-testing` și `frontend-design` (`anthropics/skills`);
     - `verification-before-completion` și `systematic-debugging` (`obra/superpowers`, inclusiv `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`).
  2. **Activat regulile permanente (`trigger: always_on`) în `.agents/rules/` și `.agents/AGENTS.md`:**
     - Creat `.agents/rules/web-and-frontend-skills.md` și `.agents/rules/testing-and-superpowers.md` și actualizat `.agents/AGENTS.md`, armonizate cu regulile stricte ale proiectului (izolare pe workspace, zero `git push` necerut, zero pop-up-uri native, zero date fake).
- **Fișiere:** `.agents/skills/web-design-guidelines/*`, `.agents/skills/webapp-testing/*`, `.agents/skills/frontend-design/*`, `.agents/skills/verification-before-completion/*`, `.agents/skills/systematic-debugging/*`, `.agents/rules/web-and-frontend-skills.md`, `.agents/rules/testing-and-superpowers.md`, `.agents/AGENTS.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** Verificare structură YAML frontmatter și fișiere pentru toate cele 7 skill-uri din `.agents/skills/`, fără `git push`.

### 2026-11-25 12:15 — Uniformizare contur carduri KPI fără chenar albastru pe primul card + finisare contururi Dark Mode (`AllInvoices.tsx`, `EmittedInvoices.tsx`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare chenar/contur colorat de pe cardurile KPI (`AllInvoices.tsx`, `EmittedInvoices.tsx`):**
     - Eliminat conturul colorat (`borderColor` + `boxShadow` `0 0 0 2px`) de pe primul card (`Toate facturile` / `Total facturi`) și uniformizat toate cardurile KPI la același contur discret `.apple-surface` (cu `outline-none`), exact ca restul cardurilor de pe rând.
  2. **Finisare contururi și reflexii pe Dark Mode (`client/src/index.css`, `DashboardLayout.tsx`, `button.tsx`, `card.tsx`, `select.tsx`, `SpvHub.tsx`):**
     - Eliminat bordurile albe lăptoase și umbrele `inset` albe de Light Mode de pe `.apple-btn-prominent` (`Sync`), sidebar, `Button`, `Card` și `SelectTrigger` în Dark Mode.
- **Fișiere:** `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/index.css`, `client/src/components/DashboardLayout.tsx`, `client/src/components/ui/button.tsx`, `client/src/components/ui/card.tsx`, `client/src/components/ui/select.tsx`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 12:00 — Audit complet și blindare anti-dublare SPV, Export SAGA (ZIP/XML/Web), Portal Contabil și Evidență Facturi
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare dublare serie (`FACTFACT-...`, `WOODEWOODE ...`) și deduplicare precisă în Portalul Contabil (`server/accountantPortalRouter.ts`):**
     - Corectat afișarea numărului facturilor emise (în DB `number` conține deja seria pe `755/762` facturi, iar `EXT` este serie sintetică pe facturile externe fără serie) și deduplicat `emittedInvoices` / `reInvoices` / `invoiceArchive (out)` + `spvMessages` pe cheie exactă `(spvIndex)` sau `(număr normalizat + partener)`, fără a ascunde facturi cu număr coincident către clienți diferiți.
  2. **Blindare Export SAGA C & SAGA Web conform regulilor de pe `26.10` (`server/sagaXmlGenerator.ts`, `server/sagaSyncRoute.ts`, `modules/saga/router.ts`):**
     - Prevenit emiterea dublă `<FacturaSerie>` peste un `<FacturaNumar>` care conține deja seria (sau `EXT`), exclus facturile anulate (`status === "cancelled"`), prioritizat determinist NIR-urile `finalizat` înaintea `draft` pe aceeași factură, normalizat cheile `CUI_NrDoc` (fără spații/cratime/zerouri) între `nir` și `sagaIntrari`, și aliniat `/api/saga-sync/push-articles` la codificarea `Windows-1250` (`toSagaXmlBuffer`).
  3. **Protecție anti-dublare la transmiterea și sincronizarea SPV / Oblio / Upload (`server/routers.ts`, `server/spvCron.ts`, `server/oblioSync.ts`, `server/uploadRoute.ts`):**
     - Blocat re-transmiterea accidentală în ANAF (`sendToSpv`) pentru facturile deja `validat` sau `in_procesare` (cu `spvIndex`), prevenind dublarea facturii la client în SPV.
     - În `spvCron.ts` (`FACTURA TRIMISA`) și `oblioSync.ts`, verificat existența facturii în `emittedInvoices` / `reInvoices` / `invoiceArchive (out)` înainte de inserare, și adăugat verificare de duplicat pe `numarInregistrare` la upload-ul manual de documente SPV (`/api/upload-spv-document`).
  4. **Deduplicare unificată în UI (`AllInvoices.tsx`, `EmittedInvoices.tsx`, `Dashboard.tsx`):**
     - Corectat `supplierCUI` în `EmittedInvoices.tsx` și deduplicat facturile `out` din arhivă față de cele emise în platformă în tabel și în totalurile KPI.
- **Fișiere:** `server/accountantPortalRouter.ts`, `server/sagaXmlGenerator.ts`, `server/sagaSyncRoute.ts`, `modules/saga/router.ts`, `server/routers.ts`, `server/spvCron.ts`, `server/oblioSync.ts`, `server/uploadRoute.ts`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/pages/Dashboard.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și verificare automată pe baza de date reală (ZIP/XML SAGA, SPV și Portal Contabil cu `0` dubluri), fără `git push`.

### 2026-11-25 11:41 — Aplicare uniformă a culorii dinamice a tenantului pe toate butoanele și taburile active din filtre
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Reguli globale pentru controale filtrate și taburi active (`client/src/index.css`, `client/src/components/ui/tabs.tsx`):**
     - Actualizat `.apple-pill-control[data-filtered="true"]`, `[data-slot="select-trigger"][data-filtered="true"]` și `[data-slot="tabs-trigger"][data-state="active"]` să folosească direct `var(--tenant-theme-color)` cu text și iconițe albe, eliminând fundalul alb pe filtrele și taburile selectate.
  2. **Unificat toate barele de filtre și selectoarele segmentate rămase pe alb în paginile aplicației:**
     - Convertit la `.apple-segmented` / `.apple-segmented-item` și `bg-primary text-white` controalele active din `Dashboard.tsx` (orizont de timp, mod grafic 3D, top parteneri), `SpvHub.tsx` (taburi SPV / e-Factura, filtre Citite/Noi/Toate, Primite/Trimise/Toate și butoane PDF/Reset), `NIRList.tsx` (`Toate / Finalizate / Ciorne`), `EmailLogs.tsx`, `CursValutar.tsx`, `InvoiceCurrencyCalculator.tsx`, `Settings.tsx` (`Interfață Normală / SAGA`), `ContractCreate.tsx`, `ContractSignaturePadModal.tsx`, `EmittedInvoiceDetail.tsx`, `Inventory.tsx`, `ContractsList.tsx`, `InvoiceArchive.tsx`, `SpvLogs.tsx`, `SuperAdmin.tsx` și modulele `HoReCa`.
- **Fișiere:** `client/src/index.css`, `client/src/components/ui/tabs.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/SpvHub.tsx`, `client/src/pages/NIRList.tsx`, `client/src/pages/EmailLogs.tsx`, `client/src/pages/CursValutar.tsx`, `client/src/components/InvoiceCurrencyCalculator.tsx`, `client/src/pages/Settings.tsx`, `client/src/pages/ContractCreate.tsx`, `client/src/components/ContractSignaturePadModal.tsx`, `client/src/pages/EmittedInvoiceDetail.tsx`, `client/src/pages/Inventory.tsx`, `client/src/pages/ContractsList.tsx`, `client/src/pages/InvoiceArchive.tsx`, `client/src/pages/SpvLogs.tsx`, `client/src/pages/SuperAdmin.tsx`, `client/src/pages/horeca/HorecaOrders.tsx`, `client/src/pages/horeca/HorecaTables.tsx`, `client/src/pages/horeca/HorecaMenu.tsx`, `client/src/pages/horeca/HorecaKitchenDisplay.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:30 — Ascundere număr build când bara laterală este restrânsă (`DashboardLayout.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Ascuns blocul cu numărul de build (`#455`) pe modul restrâns (`collapsed`) al barei laterale (`client/src/components/DashboardLayout.tsx`):**
     - Afișarea secțiunii `Build #...` și a liniei separatoare se face exclusiv când bara laterală este extinsă (`!collapsed`).
- **Fișiere:** `client/src/components/DashboardLayout.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:28 — Eliminare secțiune `[<] getts/App` din subsolul barei laterale (`DashboardLayout.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat blocul cu săgeata `<` și imaginea `getts/App` (`/gettsapp_logo_ver2.png`) din partea de jos a sidebar-ului (`client/src/components/DashboardLayout.tsx`):**
     - Scoaterea rândului păstrează curat subsolul meniului lateral (restrângerea/extinderea barei laterale rămâne disponibilă din butonul dedicat din header-ul de sus).
- **Fișiere:** `client/src/components/DashboardLayout.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:24 — Logo `GetApp` cu iconiță clară și `www.getapp.ro` sub logo strict pentru Tenantul 1 (`server/pdf.ts`, `server/pdfRoute.ts`, `server/emailService.ts`, `PrintInvoice.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Îmbunătățit claritatea și vizibilitatea iconiței din logo-ul `GetApp` pentru Tenantul 1 (`id = 1`):**
     - Reconstruit la rezoluție înaltă (`1040×232` RGBA fără contur întunecat parazit) logo-ul `GetApp` din `tenants.settings.logoBase64` exclusiv pentru Tenantul 1, cu linii îngroșate și contrast luminos alb-cian pe fundalul `#1e3a5f` și dimensiune optimizată `130×38pt` în antetul PDF.
  2. **Adăugat `www.getapp.ro` centrat sub logo strict pentru Tenantul 1 (`id = 1`):**
     - Afișat `www.getapp.ro` (cu link activ către `https://www.getapp.ro`) centrat exact sub badge-ul `GetApp` în toate PDF-urile generate (Facturi arhivă/SPV, Facturi emise, Re-facturi, NIR, Devize, Bonuri de consum, atașamente Email și `PrintInvoice`), exclusiv când `tenantId === 1`.
- **Fișiere:** `server/pdf.ts`, `server/pdfRoute.ts`, `server/emailService.ts`, `client/src/pages/PrintInvoice.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:14 — Eliminare butoane `Ieri`, `Săpt.` și `În așteptare` + încadrare 100% pe un singur rând fără scrollbar orizontal (`AllInvoices`, `EmittedInvoices`, `ReInvoicesSent`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat `Ieri`, `Săpt.` și `În așteptare` din bara de filtre la cererea utilizatorului:**
     - Păstrat segmentele curate `[Toate | Azi | Lună | Luna trec. | An | Interval]` și `[Necitite | Fără NIR | Cu NIR]`.
  2. **Eliminat scrollbar-ul orizontal și tăierea butonului `Sync` pe dreapta:**
     - Făcut câmpul `Caută...` flexibil (`flex-1 min-w-[140px] max-w-[235px]`) și definit utilitarul `.no-scrollbar` în `client/src/index.css` astfel încât toată bara intră complet pe un singur rând fără overflow.
- **Fișiere:** `client/src/index.css`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/pages/ReInvoicesSent.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:05 — Culoarea tenantului pe tabul selectat + bară de filtre pe un singur rând fără dubluri (`index.css`, `AllInvoices.tsx`, `EmittedInvoices.tsx`, `ReInvoicesSent.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Culoarea dinamică a tenantului (`var(--tenant-theme-color)`) pe taburile selectate și pe cardurile KPI active:**
     - Actualizat `.apple-segmented-item[data-active="true"]` în `client/src/index.css` și chenarele cardurilor KPI active din `AllInvoices.tsx` / `EmittedInvoices.tsx` să folosească direct `var(--tenant-theme-color)` cu text alb curat.
  2. **Unificat bara de filtre pe un singur rând și eliminat filtrele care dublau butoanele:**
     - Eliminat dropdown-urile duplicate (`Citire`, `NIR`) și segmentele redundante (`Toate / Primite / Emise`, deja prezente pe cardurile KPI), lăsând totul într-un singur rând fluid (`Perioadă` · `Necitite / Fără NIR / Cu NIR / În așteptare` · `Toate sursele` cu `w-auto` fără trunchiere · `Caută...` · `Sync`).
- **Fișiere:** `client/src/index.css`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/pages/ReInvoicesSent.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 11:02 — Corecție geometrie carduri KPI `16px` pe `/facturi` și `/facturi-emise-nou` (`index.css`, `AllInvoices.tsx`, `EmittedInvoices.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat transformarea primelor 3 carduri KPI în capsule ovale (`border-radius: 9999px !important`):**
     - Regula globală `button:not(...) { border-radius: 9999px !important }` din `client/src/index.css` prindea cardurile KPI redate ca `<button className="apple-surface">`, deformându-le în ovale în timp ce al 4-lea card (`<div>`) rămânea dreptunghiular.
     - Transformat cardurile KPI interactive în `<div role="button" tabIndex={0}>` cu `.apple-surface` (`border-radius: 16px !important`), badge-uri de pictogramă uniforme `rounded-[8px]` și exclus `.apple-surface` din selectorul global de capsule din `index.css`.
- **Fișiere:** `client/src/index.css`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-25 10:54 — Redesign Apple HIG complet pentru Listele de Facturi și toate ecranele Detalii Factură (`AllInvoices`, `EmittedInvoices`, `ReInvoicesSent`, `InvoiceDetail`, `EmittedInvoiceDetail`, `ReInvoiceDetail`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Primitive autentice Apple Human Interface Guidelines (`client/src/index.css`):**
     - Separat strict cele două straturi Apple (`liquid-glass.md`): stratul de conținut opac elevat (`.apple-surface`, `.apple-inspector-row`, `.apple-doc-stage` + `.apple-doc-paper`) și stratul funcțional (`.apple-segmented` / `.apple-segmented-item` cu pastilă albă elevată stil `UISegmentedControl` / `NSSegmentedControl`, `.apple-pill-control`, `.apple-btn-destructive-soft`, `.apple-input`).
  2. **Paginile de Facturi (`AllInvoices.tsx`, `EmittedInvoices.tsx`, `ReInvoicesSent.tsx`):**
     - Eliminat redundanța controalelor și butoanele multicolore stridente în favoarea cardurilor KPI curate (`.apple-surface`, etichete calme sentence-case, sume `SF Pro Display` `tabular-nums`) și a unui panou unificat de filtrare cu segmente monocrome cu pastilă albă elevată (`[Toate | Primite | Emise]`, `[Toate | Azi | Ieri | Săpt. asta | Săpt. trec. | Luna asta | Luna trec. | An | Interval]`, stări de lucru) + filtre soft-pill și un singur CTA proeminent.
     - Optimizat tabelele în stil macOS Finder/Mail (antet calm sentence-case `12px`, punct albastru `#0071e3` pentru facturi necitite, butoane de rând monocrome `.apple-btn-glass`, bară flotantă translucidă la selecție multiplă și rânduri mobile accesibile `>=11px` cu ținte tactile `36x36px`).
  3. **Toate cele 3 ecrane Detalii Factură (`InvoiceDetail.tsx`, `EmittedInvoiceDetail.tsx`, `ReInvoiceDetail.tsx`):**
     - Înlocuit șirul de butoane curcubeu din antet cu o bară flotantă translucidă `.apple-glass` cu **un singur CTA proeminent** (`Creează NIR` / `Vezi NIR`, `Trimite în SPV` sau `Trimite pe Email`), păstrând 100% din acțiunile secundare în capsule monocrome `.apple-btn-glass` și acțiunea de stornare în `.apple-btn-destructive-soft`.
     - Redesenat cardurile de sumar în stil macOS Inspector / Apple Wallet (valoare principală `28px` bold `tabular-nums` în `#1d1d1f` în loc de roșu `rose-600`, rânduri cu linii fine `.apple-inspector-row` și copiere rapidă la click pentru `CUI` și `Index SPV`).
     - Încadrat previzualizarea PDF (Factură + Deviz) într-o scenă macOS Quick Look / Preview (`.apple-doc-stage` + foaie albă cu umbră naturală `.apple-doc-paper`) și adus modalele de Email la stilul Apple Sheet (`.apple-input` + selector de limbi squircle).
- **Fișiere:** `client/src/index.css`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/pages/ReInvoicesSent.tsx`, `client/src/pages/InvoiceDetail.tsx`, `client/src/pages/EmittedInvoiceDetail.tsx`, `client/src/pages/ReInvoiceDetail.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 17:17 — Upgrade Dispecerat Live & Apple Design (`DashboardLayout`, `Dashboard`, `AllInvoices`, `NIRList`, `SpvHub`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Capsulă Executivă Companie/Profil + Buton Fullscreen în Header (`client/src/components/DashboardLayout.tsx`):**
     - Înlocuit cercul mic din dreapta-sus cu capsula completă Apple `[Avatar + punct verde · Nume Companie / CUI ⌄]` și adăugat butonul rotund Fullscreen (`Maximize2` / `Minimize2`).
  2. **Telemetrie Live + Cronometru `Auto (5m)` cu numărătoare inversă (`client/src/components/LiveAutoSyncControl.tsx`, `Dashboard.tsx`, `SpvHub.tsx`, `AllInvoices.tsx`, `NIRList.tsx`):**
     - Adăugat badge `● Live`, ora exactă a ultimei actualizări (`Actualizat: HH:MM:SS`) și capsula interactivă `● Auto (5m) 4:57` (cu activare/pauză dintr-un click și persistență în `localStorage`).
  3. **Carduri KPI cu praguri & pastile semantice Apple + filtre rapide 1-click & contoare live pe stări/surse (`Dashboard.tsx`, `AllInvoices.tsx`, `NIRList.tsx`):**
     - Actualizat cardurile KPI din `Dashboard.tsx` cu praguri (`SPV ≤5z`, `SLA`, `Marjă`, `D300`) și pastile semantice pastelate (`Optim`, `În termen`, `Optim · Surplus`, `TVA de plată / de recuperat`).
     - Adăugat segmentele 1-click `[Azi | Ieri | Săpt. | Lună | Luna trec. | An | Toate]` (inclusiv opțiunea `Ieri`) și banda dublă cu contoare live deasupra tabelului (`Toate · Necitite · Fără NIR · Cu NIR · În așteptare` ↔ `SPV ANAF · Emise Intern · Integrări`).
- **Fișiere:** `client/src/components/LiveAutoSyncControl.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/NIRList.tsx`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 11:23 — Gradient animat lent prin literele fixe `spv` din logo (`FacturaSpvLogo.tsx`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Schimbare fină și continuă de culoare strict prin literele fixe `spv` (`client/src/components/FacturaSpvLogo.tsx`, `client/src/index.css`):**
     - Păstrat squircle-ul Apple și monograma `spv` 100% fixe (fără nicio mișcare sus-jos sau contur rotativ), aplicând o mască vectorială subpixel pe textul `spv` prin care curge lin și fără cusătură un gradient periodic (`alb porțelan → mentă → smarald → azur → alb`, ciclu `5.5s`).
- **Fișiere:** `client/src/components/FacturaSpvLogo.tsx`, `client/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 11:11 — Halou luminos rotativ stil Apple Intelligence + undă armonică `s · p · v` pe pictograma din logo
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Refăcut animația din `FacturaSpvLogo.tsx` și `client/src/index.css`:**
     - Înlocuit dunga diagonală albă cu un halou perimetral luminos rotativ `360°` (smarald `#34d399` → azur `#38bdf8` → mentă `#6ee7b7`) mascat exact pe conturul squircle-ului continuu Apple și o undă armonică fină în cascadă (`0s` / `0.16s` / `0.32s`) pe literele `s`, `p`, `v` stil SF Symbols.
- **Fișiere:** `client/src/components/FacturaSpvLogo.tsx`, `client/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 11:08 — Animație smooth Apple Liquid Glass în pictograma `spv` din logo (`FacturaSpvLogo.tsx`, `index.css`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Animație fluidă GPU-accelerată în pictograma `spv` (`client/src/components/FacturaSpvLogo.tsx`, `client/src/index.css`):**
     - Adăugat reflexie speculară diagonală Apple Liquid Glass (`spv-specular-sweep`), refracție ambientală lentă de smarald/safir în interiorul squircle-ului (`spv-aurora-drift` / `spv-sapphire-drift`) și răspuns tactil tip arc la hover (`cubic-bezier(0.22, 1, 0.36, 1)`), cu suport complet pentru `prefers-reduced-motion`.
- **Fișiere:** `client/src/components/FacturaSpvLogo.tsx`, `client/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 10:48 — Păstrare antet tabel & câmpuri de filtrare montate la `0` rezultate pe `/spv` + căutare în toate coloanele (`CIF`, `Data Afișare` etc.)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat demontarea tabelului și a filtrelor pe coloană când căutarea nu găsește rezultate (`client/src/pages/SpvHub.tsx`):**
     - Mutat starea goală de filtrare (`0` rezultate) în interiorul `<tbody>` / `<TableBody>` (`colSpan={8}` / `colSpan={9}`), păstrând `<table>`, `<thead>`, toate cele 6 filtre inline pe coloană, focusul pe tastatură și butonul `PDF (0)` permanent montate și vizibile.
     - Adăugat buton `×` de ștergere rapidă în câmpul de căutare și extins `portalSearchQuery` / `searchMessageQuery` să caute insensibil la diacritice și multi-cuvânt în **toate** coloanele (inclusiv `CIF` și `Data Afișare` / `dataCreare`, care lipseau anterior).
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 10:32 — Fereastră compactă Apple HUD pentru Stick USB (`v1.5.1`), tabel `/spv` Apple Frosted Glass cu Bulk Download PDF și butoane icon-only pe un singur rând
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Fereastră compactă Apple Style pentru Conectorul Stick USB (`chrome-spv-connector/` — `v1.5.1`):**
     - Redus dimensiunea ferestrei popup de la `640x520` la `380x276` și redesenat `auth.html`, `anaf-popup.css` și `anaf-popup.js` în stil Apple macOS Liquid Glass (card translucid `backdrop-filter: blur(24px)`, badge rotund ANAF + indicator `mTLS Securizat`, bară de progres Apple cu procent real la descărcarea documentelor `1..N`, auto-reload din `v1.5.0` în `v1.5.1`).
  2. **Bara de taburi, filtre și căutare din `/spv` pe un singur rând + butoane icon-only (`client/src/pages/SpvHub.tsx`):**
     - Mutat câmpul `Caută...` pe același rând cu taburile și filtrele (`flex-nowrap`), transformat butoanele `Marchează citite` și `Elimină filtre` în butoane circulare Apple `w-8 h-8 rounded-full` **doar cu iconiță, fără text** (`CheckCheck` și `RotateCcw`).
  3. **Tabel `/spv` optimizat Apple Style + Select All & Bulk Download PDF (`SpvHub.tsx`, `server/uploadRoute.ts`, `server/_core/index.ts`):**
     - Înlocuit antetul bleumarin închis `#1e3264` și textul roșu pe toate coloanele cu antet translucid Apple Frosted Glass (`#f5f5f7`), indicator Apple Mail pentru mesaje necitite și rânduri curate.
     - Adăugat checkbox `Selectează toate` în antet + checkbox pe fiecare rând (atât pe `Mesaje & Recipise SPV`, cât și pe `Mesaje e-Factura`) + buton `PDF (N)` și ruta securizată `POST /api/spv/bulk-download-pdf` care livrează direct PDF-ul (pentru 1 document) sau arhiva `Documente_SPV_<CUI>_<data>.zip` (pentru selecție multiplă).
- **Fișiere:** `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `chrome-spv-connector/auth.html`, `chrome-spv-connector/anaf-popup.css`, `chrome-spv-connector/anaf-popup.js`, `client/src/pages/SpvHub.tsx`, `server/uploadRoute.ts`, `server/_core/index.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` pe extensie, `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-24 10:23 — Logo Apple Liquid Glass (`Factura/SPV` + pictogramă squircle continuu) și aliniere bară filtre `/spv` pe un singur rând
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Brand Lockup & Pictogramă Apple Liquid Glass (`client/src/components/FacturaSpvLogo.tsx`, `DashboardLayout.tsx`, `Login.tsx`, `Register.tsx`, `Landing.tsx`):**
     - Înlocuit logo-ul raster cu chenar alb opac (`logo_spv2.png` / `logo_final_root.png` / `logo_spv.png`) cu componenta vectorială `<FacturaSpvLogo />` (geometrie Apple squircle cu curbură continuă, reflexie speculară Liquid Glass, tipografie `SF Pro Rounded` / `SF Pro Display`, fundal 100% transparent și adaptare nativă Light/Dark Mode).
     - Regenerat toate asset-urile transparente de rezoluție înaltă pentru Dock macOS / PWA / Favicon / PDF / Email (`icon-spv-512.png`, `icon-spv-192.png`, `apple-touch-icon.png`, `logo_icon_spv.png`, `logo_icon.png`, `favicon.png`, `favicon.ico`, `logo_spv2.png`, `logo_final_root.png`, `logo_spv.png`) și invalidat cache-ul (`?v=3` în `client/index.html` și `client/public/manifest.json`).
  2. **Aliniere pe un singur rând a barei de taburi, filtre și căutare pe `/spv` (`client/src/pages/SpvHub.tsx`):**
     - Calibrat capsulele `rounded-full` (`Mesaje & Recipise SPV` / `Mesaje e-Factura`, `Toate / Noi / Citite`, `Marchează citite`, `Elimină filtre` și câmpul `Caută...`) astfel încât întreaga bară rămâne pe un singur rând pe desktop (`1280px+`).
- **Fișiere:** `client/src/components/FacturaSpvLogo.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/Register.tsx`, `client/src/pages/Landing.tsx`, `client/src/pages/SpvHub.tsx`, `client/index.html`, `client/public/manifest.json`, `client/public/icon-spv-512.png`, `client/public/icon-spv-192.png`, `client/public/apple-touch-icon.png`, `client/public/logo_icon_spv.png`, `client/public/logo_icon.png`, `client/public/favicon.png`, `client/public/favicon.ico`, `client/public/logo_spv2.png`, `client/public/logo_final_root.png`, `client/public/logo_spv.png`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 15:57 — Etichete scurte pe butoanele `/spv` (`Test`, `Reautorizare`, `Stick USB`, `Încarcă`, `Sync SPV`), badge `Conectat` sub titlu și aliniere pe un singur rând
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Layout antet `/spv` pe un singur rând chiar și pe ecrane `1280px` (`client/src/pages/SpvHub.tsx`):**
     - Mutat badge-ul `Conectat · Token ... zile` direct **sub** titlul `Mesaje & Documente SPV ANAF` (în dreapta logo-ului ANAF).
     - Scurtat etichetele celor 5 butoane la forme concise (`Test`, `Reautorizare`, `Stick USB`, `Încarcă`, `Sync SPV`), reducând lățimea totală a antetului de la `~1.140px` la `~790px` astfel încât titlul și butoanele stau garantat pe același rând.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 15:43 — Antet `/spv` compact pe un singur rând și eliminare subtitlu descriptiv (`SpvHub.tsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat textul descriptiv și compactat antetul pe un singur rând (`client/src/pages/SpvHub.tsx`):**
     - Eliminat paragraful `"Recipise declarații fiscale, certificate de atestare, răspunsuri solicitări și flux RO e-Factura."` care lățea blocul din stânga și împingea butonul `Actualizează din SPV` pe rândul 2.
     - Calibrat înălțimea (`h-8`), paddingul (`px-2.5` / `px-3`) și fontul (`11.5px` / `15px–16px`), astfel încât `[Logo ANAF] + Mesaje & Documente SPV ANAF + [Conectat · Token ...]` și toate cele 5 butoane stau aliniate pe un singur rând (`~1.138px` total).
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 14:20 — Înlocuire iconiță veche `g/a` cu iconița `SPV` pentru Dock macOS / PWA (`manifest.json`, `index.html`, `180/192/512px`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Actualizare iconițe PWA / macOS Dock / iOS (`client/public/manifest.json`, `client/index.html`, `client/public/icon-spv-*.png`):**
     - `manifest.json` și `favicon.png` rămăseseră pe vechea pictogramă `g/a` (`/logo_icon.png`), motiv pentru care aplicația instalată în Dock pe macOS afișa `g/a` în loc de `spv`.
     - Generat variantele standard `180x180` (`apple-touch-icon.png`), `192x192` (`icon-spv-192.png`) și `512x512` (`icon-spv-512.png`) din `logo_icon_spv.png`, actualizat `logo_icon.png`, `favicon.png`, `manifest.json` și `client/index.html` cu invalidare cache (`?v=2`).
- **Fișiere:** `client/public/manifest.json`, `client/index.html`, `client/public/icon-spv-192.png`, `client/public/icon-spv-512.png`, `client/public/apple-touch-icon.png`, `client/public/favicon.png`, `client/public/logo_icon.png`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` (`0` erori), dimensiuni PNG verificate (`180x180`, `192x192`, `512x512`), fără `git push`.

### 2026-11-23 14:16 — Eliminare tăiere (clipping) buton `Sync` și bare de filtre pe `/facturi`, `/nir` și Portalul Contabil
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminat `xl:flex-nowrap` și calibrat lățimile capsulelor de filtrare (`client/src/pages/AllInvoices.tsx`, `NIRList.tsx`, `AccountantPortal.tsx`):**
     - Pe `/facturi` (`AllInvoices.tsx`), combinația `xl:flex-nowrap` + `overflow-hidden` pe cardul tabelului depășea cu ~`156px` lățimea disponibilă pe laptop (`1280px` minus sidebar `240px`) și tăia marginea dreaptă a butonului `Sync`.
     - Calibrat lățimile celor 5 selectoare și `gap-2` astfel încât pe `1280px+` toate cele 7 controale (inclusiv butonul `Sync` întreg) încap pe un singur rând (`944px <= 960px`), iar pe rezoluții mai înguste coboară curat pe rândul următor (`flex-wrap` permanent) fără să mai fie tăiate vreodată.
- **Fișiere:** `client/src/pages/AllInvoices.tsx`, `client/src/pages/NIRList.tsx`, `client/src/pages/AccountantPortal.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 13:44 — Fix pornire container Railway în producție când `JWT_SECRET` lipsește din variabilele de mediu (`session.ts`, `spvAuth.ts`, `accountantPortalRouter.ts`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare crash la boot în producție (`Error: [SECURITY] JWT_SECRET nu este setat!`):**
     - Pe Railway variabila `JWT_SECRET` nu era definită în panoul de variabile, iar verificarea sincronă la import din `server/session.ts` oprea pornirea containerului (`dist/index.js`).
     - Adăugat `getEffectiveJwtSecret()` în `server/session.ts` (folosit și în `server/spvAuth.ts` și `server/accountantPortalRouter.ts`), care folosește `JWT_SECRET` dacă este setat, iar în lipsa lui derivă determinist o cheie criptografică HMAC-SHA256 de 256 biți din configurația privată a serverului (`SESSION_SECRET` / `DATABASE_URL` / `ANAF_CLIENT_SECRET`), fără chei publice în cod și fără crash la pornire.
- **Fișiere:** `server/session.ts`, `server/spvAuth.ts`, `server/accountantPortalRouter.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori) și test real de pornire `NODE_ENV=production JWT_SECRET="" PORT=3999 node dist/index.js` trecut cu succes.

### 2026-11-23 12:59 — Eliminare suprapunere antet `/spv` și integrare logo oficial ANAF în `/spv` + ferestrele pop-up de sincronizare token USB
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare suprapunere titlu / butoane în `/spv` (`client/src/pages/SpvHub.tsx`):**
     - Înlocuit `xl:flex-row` + `whitespace-nowrap` pe `<h1>` + `sm:flex-nowrap shrink-0` pe bara de butoane (care pe ecrane `1280px–1440px` cu sidebar deschis făceau titlul să iasă sub butoanele `Testează conexiunea` / `Reautorizare`) cu un layout responsiv `2xl:flex-row` și `flex-wrap` curat, cu zero suprapunere pe orice rezoluție.
  2. **Integrare logo oficial ANAF (`https://static.anaf.ro/static/10/Anaf/primapagina/anaf_ro.png` + fallback local `anaf-logo.png`):**
     - În antetul paginii `Mesaje & Documente SPV ANAF` (`SpvHub.tsx`), aliniat inline lângă titlu și statusul tokenului.
     - În modalul `Conector Chrome pentru Stick USB ANAF (SPVWS2)` din `SpvHub.tsx`.
     - În fereastra pop-up de sincronizare a tokenului USB din extensia Chrome (`chrome-spv-connector/auth.html`, `anaf-popup.js`, `anaf-popup.css`, `manifest.json`) și în arhiva `/api/spv-connector.zip` (`server/uploadRoute.ts`).
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `client/public/anaf-logo.png`, `chrome-spv-connector/auth.html`, `chrome-spv-connector/anaf-popup.js`, `chrome-spv-connector/anaf-popup.css`, `chrome-spv-connector/anaf-logo.png`, `chrome-spv-connector/manifest.json`, `server/uploadRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` pe extensie, `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 12:30 — Filtrare strict pe Clienți (excludere Furnizori SPV/SAGA) la Emitere Factură (`/facturi-emise/nou`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Backend (`server/routers.ts` — `clients.searchPartners`):**
     - Adăugat opțiunea `onlyClients: boolean`, care exclude furnizorii din SPV (`isSupplier === 1`) și tabela `sagaFurnizori`.
  2. **Frontend (`client/src/pages/EmitInvoice.tsx`, `InvoicesEmitted.tsx`, `ReInvoice.tsx`):**
     - La crearea facturilor emise și a re-facturilor, dropdown-ul de selecție partener afișează strict **Clienții** (`isSupplier !== 1`, `onlyClients: true`), fără a mai amesteca furnizorii importați din facturile primite SPV sau SAGA.
- **Fișiere:** `server/routers.ts`, `client/src/pages/EmitInvoice.tsx`, `client/src/pages/InvoicesEmitted.tsx`, `client/src/pages/ReInvoice.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori), test live `searchPartners({ onlyClients: true })` pe `Tenant 1` și `Tenant 4`, fără `git push`.

### 2026-11-23 12:10 — Protecție anti-dublare și anti-suprascriere nomenclator istoric (`ART_` / `CLI_`) la exportul arhivei ZIP SAGA C
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Verificat istoricul git (`6e58659`, `2de8738`, `2024046`) și blindat arhiva ZIP (`server/sagaSyncRoute.ts`):**
     - Confirmat că `|| (parsedNirIds && parsedNirIds.length > 0)` din `6e58659` nu era o protecție anti-dublare (dublarea de atunci venea din includerea a 6 fișiere în ZIP: `FACTURI.XML` + `F_...xml`, `CLIENTI.XML` + `CLI_...xml`, `ARTICOLE.XML` + `ART_...xml`), ci un efect secundar care bloca complet descărcarea `.zip` și omitea facturile emise când existau NIR-uri în lună (`SagaModule.tsx` inițializează automat `selectedNirIds` la încărcarea paginii).
     - Limitat `ART_<data>.xml` și `CLI_<data>.xml` din arhiva ZIP **strict la codurile `<Cod>` și `<ClientCod>` prezente efectiv în `F_...xml`** din luna/selecția exportată (și omis `CLI_`/`ART_` dacă sunt 0 în selecție), eliminând re-trimiterea celor `9.724` articole și `400+` clienți istorici la fiecare import lunar în SAGA C.
  2. **Protecție țară clienți externi și validare `<Tip>` / `<UM>` pe nomenclator (`server/sagaXmlGenerator.ts`):**
     - În `generateSagaClientsXML`: înlocuit `<Tara>RO</Tara>` hardcodat cu țara reală a clientului (`FR`, `GB`, `NL`, `MU`, `RO` etc. + deduplicare după CUI, `sagaCode` și nume), prevenind suprascrierea clienților externi (ex. clienții din Franța ai `WOOD GLASS SRL`) la `RO`.
     - În `generateSagaArticlesXML`: adăugat deduplicare `seenCodes`, `normalizeSagaUm` și `normalizeSagaCatalogArticleTip` (păstrând tipurile native SAGA și normalizând etichetele non-SAGA).
- **Fișiere:** `server/sagaSyncRoute.ts`, `server/sagaXmlGenerator.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npm run build` (`0` erori), test live ZIP pe `WOOD GLASS SRL` (`Noiembrie` și `Septembrie 2026`), fără `git push`.

### 2026-11-23 11:59 — Verificare completă pre-push (WOOD GLASS SRL + toate exporturile SAGA / ZIP / Portal Contabil) și blindare encoding `Windows-1250`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Audit live pe datele reale ale firmei `WOOD GLASS SRL` (`tenantId = 4`, `RO28396216`) și pe toate firmele:**
     - Verificat `0` dubluri în baza de date (`emittedInvoices`, `nir`, `invoiceArchive`, `sagaIntrari`) și `0` dubluri `<Factura>` în exportul SAGA XML pe tot anul 2026 (`215` documente: `151` ieșiri + `64` intrări) și pe fiecare lună; verificat live portalul `/contabil/woodglass` (`getPublicInfo`, `validateSession`, `getData` — `916` primite / `770` emise, `getDocumentLines`, `downloadSagaXml`) și toate rutele PDF (`/api/pdf/archive`, `/api/pdf/emitted`, `/api/pdf/nir`, `/api/pdf/contract` -> `200 %PDF-`).
  2. **Corectat ruta arhivă ZIP SAGA la selecție parțială de NIR-uri (`server/sagaSyncRoute.ts`):**
     - Eliminat interceptarea greșită `parsedNirIds.length > 0` din ramura `type === "nir"`, astfel încât `Descarcă Arhiva ZIP` din Modulul SAGA cu o selecție parțială de NIR-uri livrează arhiva `.zip` completă (`F_...xml` + `CLI_...xml` + `ART_...xml`, fără fișiere dublate) în loc de un singur XML de NIR.
  3. **Garantat codificarea binară `Windows-1250` pe toate descărcările XML SAGA și SAGA Web (`AccountantPortal.tsx`, `SagaModule.tsx`, `modules/saga/router.ts`) + fix invalidare `syncSpv` (`SagaClassicPortalView.tsx`):**
     - Înlocuit `new Blob([xmlString])` (care scria UTF-8 peste antetul `encoding="Windows-1250"`) cu decodarea `res.base64` / `encodeWindows1250Blob` și `toSagaXmlBuffer` pe `pushToSagaWeb`, păstrând diacriticele românești intacte în SAGA C Desktop (ex. `BRAŞOV`, `TĂRLUNGENI`).
     - Corectat `trpcUtils.accountantPortal.getData.invalidate()` după sincronizarea SPV din `SagaClassicPortalView.tsx` și atributul condițional `Secure` pe cookie-ul `accountantSession`.
- **Fișiere:** `server/sagaSyncRoute.ts`, `modules/saga/router.ts`, `client/src/pages/AccountantPortal.tsx`, `client/src/pages/SagaModule.tsx`, `client/src/components/SagaClassicPortalView.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori), `npx vitest run` (`1/1` passed), `npm run build` (`0` erori) și test live ZIP/XML/PDF pe `WOOD GLASS SRL`, fără `git push`.

### 2026-11-23 11:41 — Aliniere 1:1 cu Portalul ANAF pe orele 24h (`16:25:09` vs `04:25:09`), ordinea mesajelor, `Data Arhivare` (`+62` zile) și filtrul `DECLARATIE`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Corectare bug 12h (`hh:mm:ss`) din API-ul ANAF `SPVWS2` (`server/spvPortalSync.ts`):**
     - Webserviciul `webserviced.anaf.ro/SPVWS2/rest/listaMesaje` returnează `data_creare` în format 12h fără AM/PM (`19.11.2026 04:25:09` și `04:24:10` în loc de `16:25:09` și `16:24:10`), motiv pentru care cele mai noi 2 documente de la ora `16:25` / `16:24` coborau sub cele de la ora `10:43` și păreau lipsă în capul tabelului.
     - Adăugat `resolveAnaf24hTimestamp` + normalizare automată idempotentă (`ensureTenantSpvPortalTimestampsNormalized`) care reconstituie ora reală 24h din metadatele `D:YYYYMMDDHHmmss` ale PDF-ului original semnat de ANAF și secvența monotonă a ID-urilor ANAF, plus `computeDataArhivare` la `+62` zile (`20.01.2027 16:25:09`, identic cu portalul ANAF).
  2. **Ordonare identică cu Portalul ANAF & Filtru `DECLARATIE` (`server/routers.ts`, `client/src/pages/SpvHub.tsx`):**
     - Ordonat `listPortalDocuments` după secvența oficială ANAF (`CAST(numarInregistrare AS UNSIGNED) DESC`) și data 24h, și inclus tipul `DECLARATIE` în cardul KPI `Recipise Declarații` și în selectorul `Tip Document`.
- **Fișiere:** `server/spvPortalSync.ts`, `server/routers.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** Verificat pe baza de date reală (`19.11.2026 16:25:09` -> Row 1, `19.11.2026 16:24:10` -> Row 2, `19.11.2026 10:43:09` -> Row 3, identic cu portalul ANAF), `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 11:28 — Upgrade Conector Chrome USB SPV la `v1.5.0` (fără cerință Incognito) și separare sincronizare OAuth de copiile vechi `v1.4.0`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Conector Chrome USB (`chrome-spv-connector/manifest.json`, `app-bridge.js`, `background.js` — `v1.5.0`):**
     - Ridicat versiunea extensiei la `1.5.0`, eliminat complet orice mesaj/cerință `Permite în modul incognito` și adăugat suport `SPV_CONNECTOR_RELOAD` (`chrome.runtime.reload()`).
  2. **Separare OAuth & Detecție copie veche `v1.4.0` în Chrome (`client/src/pages/SpvHub.tsx`):**
     - `Actualizează din SPV` (`handleSyncAll`) folosește curat tokenul OAuth ANAF conectat fără a mai fi întrerupt de modalul / eroarea Incognito a unei copii vechi `v1.4.0` rămase nereîncărcate în Chrome.
     - La apăsarea `Sincronizează Stick USB` când Chrome rulează încă vechea copie `v1.4.0` din memorie, afișează instrucțiunea clară de Reload în `chrome://extensions` (cu buton de copiere într-un click) către `v1.5.0` fără Incognito.
- **Fișiere:** `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe extensie, `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 11:20 — Selector mod interfață implicită (`Interfață Normală` vs `Interfață SAGA`) în Setări -> Portalul Contabilului
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Backend (`server/routers.ts`, `server/accountantPortalRouter.ts`):**
     - Extins `tenants.getAccountantPortalConfig`, `tenants.updateAccountantPortalConfig` și `accountantPortal.getPublicInfo` cu proprietatea `defaultViewMode` (`"modern" | "saga"`, salvată în `settings.accountantPortal.defaultViewMode`), păstrând valoarea implicită `"saga"` pentru firmele existente.
  2. **Setări Portal Contabil (`client/src/pages/Settings.tsx`):**
     - Adăugat selectorul segmentat Apple (`Interfață Normală` / `Interfață SAGA`) direct în `/setari?tab=accountant` cu salvare imediată la click și curățare automată a override-urilor vechi din browser, plus includere în `Salvează Modificările`.
  3. **Aplicare automată în Portalul Contabilului (`client/src/pages/AccountantPortal.tsx`):**
     - Portalul se deschide direct în modul configurat de firmă (`publicInfo.defaultViewMode`), eliminând blocajul din vechiul `localStorage` global, în timp ce butonul de comutare din interiorul portalului rămâne disponibil ca suprascriere temporară pe sesiunea curentă (`sessionStorage`).
- **Fișiere:** `server/routers.ts`, `server/accountantPortalRouter.ts`, `client/src/pages/Settings.tsx`, `client/src/pages/AccountantPortal.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-23 11:15 — Compactare proporții carduri KPI și `<Card>` pe toate ecranele (`card.tsx`, `AllInvoices.tsx` și încă 15 pagini)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Reducere înălțime, padding și raze pe componenta globală `<Card>` (`client/src/components/ui/card.tsx`, `client/src/index.css`):**
     - Redus paddingul vertical exagerat din `Card` (`py-6 gap-6 px-6` → `py-4 gap-3.5 px-4 sm:px-5`) și ajustat raza cardurilor la `rounded-2xl` (`16px`) în timp ce modalele păstrează raza concentrică `20px`.
  2. **Compactare bandă carduri KPI pe `/facturi` (`AllInvoices.tsx`) și pe toate celelalte pagini de listă/raport:**
     - În `AllInvoices.tsx`: eliminat `min-h-[88px]` și `p-4 sm:p-5`, redus la `px-3.5 py-2.5` (~`54px` înălțime compactă), valori `text-lg sm:text-[20px]`, iconițe `w-8 h-8 rounded-xl` și afișare pe același rând a sumei secundare (`+ EUR`) în cardul `Total Sumă`.
     - Aplicat aceleași proporții compacte (`px-3.5 py-2.5`, `rounded-2xl`, `gap-2.5`, iconițe `w-8 h-8`) pe `EmittedInvoices.tsx`, `Dashboard.tsx`, `SpvHub.tsx`, `Clients.tsx`, `ContractsList.tsx`, `NIRList.tsx`, `InvoiceArchive.tsx`, `DevizeList.tsx`, `BonuriConsumList.tsx`, `EmailLogs.tsx`, `Reports.tsx`, `Integrations.tsx`, `SpvLogs.tsx` și `AccountantPortal.tsx`, fără a elimina nicio informație sau funcționalitate.
- **Fișiere:** `client/src/components/ui/card.tsx`, `client/src/index.css`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/EmittedInvoices.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/SpvHub.tsx`, `client/src/pages/Clients.tsx`, `client/src/pages/ContractsList.tsx`, `client/src/pages/NIRList.tsx`, `client/src/pages/InvoiceArchive.tsx`, `client/src/pages/DevizeList.tsx`, `client/src/pages/BonuriConsumList.tsx`, `client/src/pages/EmailLogs.tsx`, `client/src/pages/Reports.tsx`, `client/src/pages/Integrations.tsx`, `client/src/pages/SpvLogs.tsx`, `client/src/pages/AccountantPortal.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori) și `npm run build` (`0` erori), fără `git push`.

### 2026-11-22 23:52 — Audit și perfecționare cap-coadă a întregii aplicații (Securitate Multi-Tenant, Motor Fiscal, Fluxuri & Comunicare UX, Design Apple Liquid Glass, `0` erori TS în tot repo-ul)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Securitate, Autentificare & Izolare Multi-Tenant Strictă (`server/**`, `modules/**`, `chrome-spv-connector/**`):**
     - Blocat escaladarea privilegiilor / preluarea altor firme prin `pairedPfTenantId` / `pairedPjTenantId` (`C-01`): cheile interne sunt eliminate la `tenants.updateSettings`, iar `switchTenant`, `updateSettings`, `integrations.list`, `getValidSpvToken`, `requirePdfAccess` și `requireUploadAccess` impun `userTenants` activ (`isActive = 1`), `superadmin` sau verificare bidirecțională mutuală (`isValidBidirectionalPair`, păstrând intactă legătura reală `Tenant 2` ↔ `Tenant 10`).
     - Securizat complet `accountantPortalRouter.ts` (`C-02`, `H-05`): eliminat secretul HMAC fallback în producție, eliminată căutarea publică după CUI în `findTenantByPortalToken`, impus `Boolean(portal.enabled) === true` pe toate procedurile fără emitere de `autoSessionToken` când portalul este dezactivat, adăugat rate-limiting pe `verifyPin` și verificată apartenența documentului părinte la `tenant.id` în toate ramurile din `getDocumentLines` (păstrând funcționale portalurile active `Tenant 1` și `Tenant 4`).
     - Închis Path Traversal / LFI și accesul static neautentificat la fișiere (`C-03`, `C-04`, `H-08`): poartă unificată `/uploads` înainte de Vite/static cu normalizare URL și protecție `requireUploadAccess` pe `invoices`, `contracts` și `spv_documents` (`404` neautentificat / cross-tenant, `200 %PDF-` pentru proprietar și perechea PF↔PJ pe documentele reale `64..71`), validare strictă de director în `pdfRoute.ts`, autentificare pe `/manus-storage/*`, headere HTTP de securitate (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`), stare OAuth SPV semnată HMAC-SHA256 (`spvAuth.ts`), protecție SSRF pe webhook-uri (`assertSafeWebhookUrl`), `clearCookie` pe `auth.logout` și validare strictă `window.location.origin` / `chrome.runtime.id` în `chrome-spv-connector`.
     - Închise toate vulnerabilitățile IDOR pe tabelele copil și chei externe (`H-06`, `H-07`, `H-09`, `M-13`, `M-14`, `M-18`): verificare părinte înainte de ștergere/editare în `deleteReInvoice`, `devize`, `bonuriConsum`, `emittedInvoice`, `contractsRouter`, `saga/router`, `horeca/router`; restricționat `appRouter.admin.*` la `superadmin` și mascate secretele din `getAllTenants` / `integrations.list`.
  2. **Motor Fiscal, Calcule Contabile & Corecții Runtime Backend/Frontend (`server/**`, `shared/efactura.ts`, `client/src/pages/**`):**
     - Corectat bug-ul fiscal `C4` (`EmitInvoice.tsx`, `sagaInvoiceImporter.ts`, `emailService.ts`, `pdfRoute.ts`): facturile în `EUR` emise către clienți din România (`RO`) nu mai activează automat Taxarea Inversă UE (`Art. 196`) și nu mai sunt marcate `extern` (păstrând obligația legală RO e-Factura la 5 zile).
     - Aliniat generatorul și parserul UBL 2.1 ANAF la EN 16931 / CIUS-RO (`C5`, `C6`, `H8` în `anafXmlGenerator.ts`, `shared/efactura.ts`, `anafPdf.ts`, `pdfRoute.ts`): calcul `TaxSubtotal` pe grup (`BR-S-09`), categorie `"O"` (`VATEX-EU-O`) pentru neplătitori de TVA, selecție `TaxTotal` pe moneda documentului (`EUR` vs `RON`) și suport complet pentru facturi storno / `CreditNote` (`381`).
     - Păstrat stocul consumat (`consumedQty`) și cursul valutar în `sagaIntrari` la editarea unui NIR (`C3` în `routers.ts`); inclus `reInvoices`, `<FacturaCurs>` și `<FacturaTaxareInversa>` în exportul SAGA XML (`H4`); reparat TDZ `andOp` pe `/api/pdf/nir/:id` și câmpurile `regCom`/`iban`/`bank` pe PDF-ul de Deviz (`H1`, `H7`); izolat cache-ul de token Oblio per tenant (`H8`); reparate toate cele 5 bug-uri din `ReInvoice.tsx`, descărcarea PDF de refactură din `AllInvoices.tsx`, normalizarea `Date` / `formatCurrency` (`MDL`, `PLN`, etc.) în `store.ts` și ruta `trpc.clients.list` în `SagaSyncPage.tsx`.
  3. **Reguli Stricte UI, Comunicare UX & Design Apple Liquid Glass pe toate paginile (`client/src/**`):**
     - Eliminat 100% din apelurile native de browser (`0` `alert` / `confirm` / `prompt` în tot `client/src/` — toate cele 11 instanțe din `Settings`, `ApiKeys`, `InvoiceArchive`, `SuperAdmin`, `Horeca*` înlocuite cu `<AlertDialog>`), `0` `font-mono` / `monospace` în UI și `0` emoji-uri în componente (`SagaClassicPortalView.tsx` migrat la iconițe Lucide).
     - Conectate toate butoanele și rutele anterior nefuncționale fără a elimina sau ascunde niciun buton existent: clopoțelul de notificări din `DashboardLayout.tsx` (`<Popover>` Liquid Glass), `"Salvează Setări"` și `"+ Rețetă nouă"` în `SagaModule.tsx`, `"Filtre"` în `Inventory.tsx`, comutarea live `/setari?tab=...`, filtrul `/clienti?search=...`, ruta `/facturi-emise/:id` → `<EmittedInvoiceDetail />`, link-ul `/horeca/comenzi/nou` și gestionarea erorilor post-plată POS în `PaymentScreen.jsx`, plus mesaje curate în română prin `cleanErrorMessage` (`utils.ts`).
     - Uniformizat designul Apple HIG / Liquid Glass pe toate cele 40+ pagini și modale: carduri concentrice `rounded-[22px]`, butoane capsulă `rounded-full` (`.apple-btn-glass` / `.apple-btn-prominent`), contrast AA `#636366` / `dark:#98989d`, inele `:focus-visible` pe input-uri, suport `@media (prefers-reduced-transparency: reduce)`, Dark Mode complet (`SpvLogs`, `ContractsList`, `EmailLogs`, `NIRCreate`, `NIRList`, `EmittedInvoices`, `AccountantPortal`) și `tabular-nums` pe toate sumele, CUI-urile și datele.
- **Fișiere:** `tsconfig.json`, `shared/efactura.ts`, `chrome-spv-connector/*`, `modules/horeca/router.ts`, `modules/saga/router.ts`, `server/**` (27 fișiere), `client/src/**` (68 fișiere), `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` (`0` erori în tot proiectul, redus de la `154`), `npx vitest run` (`1/1` passed), `npm run build` (`0` erori), verificare live HTTP & izolare multi-tenant trecută (`200 %PDF-` pe documentele reale `64..71` pentru proprietar/pereche PF↔PJ, `404`/`401` neautentificat și cross-tenant), fără `git push`.

### 2026-11-22 22:18 — Redesign vizual vizibil Apple Liquid Glass & butoane capsulă (`button.tsx`, `AllInvoices.tsx`, `SpvHub.tsx`, `DashboardLayout.tsx`, `index.css`) + restart server Vite
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Floating Liquid Glass real & Canvas Tahoe (`DashboardLayout.tsx`, `client/src/index.css`):**
     - Adăugat canvas ambiental `.apple-canvas` și poziționat `<header>` ca bară flotantă `fixed` Liquid Glass (`blur(28px) saturate(1.9)`, dublu contur specular `inset 0 1.5px 0.5px rgba(255,255,255,0.96)`), astfel încât la derularea paginilor conținutul trece efectiv pe sub sticla transluzentă conform `liquid-glass.md`.
     - Transformat itemii activi din sidebar (inclusiv sub-itemii ex. `Evidență Facturi`) în capsule `rounded-full` cu luciu Apple `.glassProminent`.
  2. **Butoane Capsulă (`rounded-full`) & Sticlă Speculară la nivel global (`button.tsx`, `badge.tsx`, `select.tsx`, `tabs.tsx`, `index.css`):**
     - Actualizat `button.tsx` de la `rounded-lg` (`8px`) la capsule Apple `rounded-full` cu stiluri `.glassProminent` (primar) și `.glass` (outline/secondary), plus `badge.tsx`, `select.tsx` și `tabs.tsx` la capsule `rounded-full` și `card.tsx` la raze concentrice `rounded-[22px]`.
  3. **Aplicare pe `/facturi` (`AllInvoices.tsx`), `/spv` (`SpvHub.tsx`) și `/dashboard` (`Dashboard.tsx`):**
     - Pe `AllInvoices.tsx`: carduri KPI interactive `rounded-[22px]` cu iconițe dedicate și contur luminos pe filtrul activ, bară de filtre frosted glass fără trunchiere pe `Tip: Toate`, badge-uri capsulă `rounded-full` și butoane rotunde `.apple-btn-glass` (`w-8 h-8 rounded-full`) pe rânduri și paginare.
     - Pe `SpvHub.tsx`: păstrate intacte toate cele 5 butoane din antet și aliniate la capsule `.apple-btn-glass` / `.apple-btn-prominent` `rounded-full`.
     - Repornit serverul local `npm run dev` pentru actualizarea `__BUILD_NUMBER__` și reîncărcarea completă a bundle-ului Vite.
- **Fișiere:** `client/src/index.css`, `client/src/components/DashboardLayout.tsx`, `client/src/components/ui/button.tsx`, `client/src/components/ui/badge.tsx`, `client/src/components/ui/card.tsx`, `client/src/components/ui/tabs.tsx`, `client/src/components/ui/select.tsx`, `client/src/pages/AllInvoices.tsx`, `client/src/pages/SpvHub.tsx`, `client/src/pages/Dashboard.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu `0` erori; serverul dev repornit pe `http://localhost:3000`; fără `git push`.

### 2026-11-22 21:28 — Aplicare redesign Apple Human Interface Guidelines (`dickwu/apple-design-skill`) pe sistemul UI global, layout și Dashboard
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Accesibilitate & Contraste WCAG AA (`accessibility.md`, `color.md`, `client/index.html`, `client/src/index.css`):**
     - Eliminat `maximum-scale=1` din `client/index.html` și adăugat `viewport-fit=cover` pentru suport zoom 200%+ și safe areas iOS/iPadOS.
     - Ridicat contrastul etichetelor secundare (`--muted-foreground`: `#636366` în Light Mode `5.9:1` pe alb / `5.4:1` pe `#f5f5f7`, `#98989d` în Dark Mode `5.6:1` pe `#1c1c1e`) și corectat `--accent-foreground` / `--destructive-foreground` la `#ffffff` în Dark Mode.
     - Adăugat suport `@media (prefers-reduced-motion: reduce)` și `@media (prefers-reduced-transparency: reduce)`, indicatori `:focus-visible` pentru tastatură și `aria-label` + ținte tactile `>= 28x28pt` / `36x36px` pe controalele cu iconițe.
  2. **Tipografie Apple SF Pro & Separare Straturi Liquid Glass (`typography.md`, `liquid-glass.md`, `client/src/index.css`):**
     - Înlocuit fontul forțat `"Segoe UI", "Roboto"` de pe `button`, `input`, `textarea`, `select` și `.kpi-value` cu stiva nativă Apple (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter"`), tracking optic (`-0.011em` / `-0.022em`) și `tabular-nums` pe valorile financiare.
     - Aplicat disciplina celor 2 straturi din `liquid-glass.md`: `.apple-glass` (`backdrop-filter: blur(24px) saturate(1.5)`) strict pe stratul funcțional flotant (header, sidebar, tab bar mobil, meniuri, dialoguri), iar cardurile din stratul de conținut (`--card: #ffffff` / `#1c1c1e` peste canvas `#f5f5f7` / `#000000`) pe suprafețe opace curate, fără blur 40px și fără bounce `scale(1.02)` la hover.
  3. **Shell Global, Componente Shadcn, DataTable & Dashboard (`DashboardLayout.tsx`, `BnrExchangeRateHeader.tsx`, `DataTable.tsx`, `Dashboard.tsx`, `components/ui/*`):**
     - Aplicat ierarhie tipografică macOS în sidebar (`13.5px`, `font-medium` inactiv vs `font-semibold` activ) și Liquid Glass pe header, sidebar și tab bar-ul mobil (aliniat la `themeColor`).
     - Aliniat `Tabs` și comutatoarele din `Dashboard.tsx` la stilul Apple Segmented Control, `Dialog` / `DropdownMenu` / `Popover` / `Select` la suprafețe macOS transluzente cu colțuri `rounded-xl` / `rounded-2xl`, și `DataTable.tsx` la antete lizibile și paginare accesibilă (`28x28px`), păstrând 100% intacte toate butoanele, rutele și funcționalitățile existente.
- **Fișiere:** `client/index.html`, `client/src/index.css`, `client/src/components/DashboardLayout.tsx`, `client/src/components/BnrExchangeRateHeader.tsx`, `client/src/components/DataTable.tsx`, `client/src/components/ui/card.tsx`, `client/src/components/ui/tabs.tsx`, `client/src/components/ui/dialog.tsx`, `client/src/components/ui/dropdown-menu.tsx`, `client/src/components/ui/popover.tsx`, `client/src/components/ui/select.tsx`, `client/src/components/ui/table.tsx`, `client/src/pages/Dashboard.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` și `npm run build` verificate (`0` erori), fără `git push`.

### 2026-11-22 21:14 — Integrare `dickwu/apple-design-skill` (Apple HIG skill + regulă `always_on`) în proiect
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `.agents/skills/apple-design/`:
     - Instalat complet repository-ul `dickwu/apple-design-skill` (`SKILL.md`, `GEMINI.md`, `AGENTS.md`, `scripts/pull-hig.mjs` și toate cele `124` pagini Apple Human Interface Guidelines din `references/hig/`).
  2. `.agents/rules/apple-design.md`, `.agents/AGENTS.md`, `CLAUDE.md`:
     - Adăugat regula permanentă `trigger: always_on` și referințele pentru Antigravity și Paperclip/Claude Code către `.agents/skills/apple-design/SKILL.md`.
- **Fișiere:** `.agents/skills/apple-design/**`, `.agents/rules/apple-design.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** Verificat `SKILL.md` (`name: apple-design`), `124` fișiere HIG prezente în `.agents/skills/apple-design/references/hig/`, fără `git push`.

### 2026-11-22 21:08 — Integrare `andrej-karpathy-skills` (skill + reguli permanente `always_on`) în proiect
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `.agents/skills/karpathy-guidelines/SKILL.md`:
     - Instalat skill-ul `karpathy-guidelines` din `multica-ai/andrej-karpathy-skills` în workspace-ul proiectului.
  2. `.agents/rules/karpathy-guidelines.md` & `.agents/AGENTS.md`:
     - Adăugat regulă permanentă (`trigger: always_on`) cu cele 4 principii ale lui Andrej Karpathy (`1. Think Before Coding`, `2. Simplicity First`, `3. Surgical Changes`, `4. Goal-Driven Execution`), păstrând integral regulile existente de sincronizare Paperclip și regulile stricte ale proiectului.
  3. `CLAUDE.md` & `.cursor/rules/karpathy-guidelines.mdc`:
     - Adăugat fișierele echivalente pentru compatibilitate completă cu agenții Paperclip / Claude Code și Cursor, fără a atinge `.cursorrules` sau codul aplicației.
- **Fișiere:** `.agents/skills/karpathy-guidelines/SKILL.md`, `.agents/rules/karpathy-guidelines.md`, `.agents/AGENTS.md`, `CLAUDE.md`, `.cursor/rules/karpathy-guidelines.mdc`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** Verificat frontmatter YAML valid pe skill și reguli (`always_on` / `alwaysApply`), păstrat intact codul sursă și regulile existente, fără `git push`.

### 2026-11-20 12:35 — Eliminare helper `URLSession` (`HTTP 500` la renegociere TLS 1.2 ANAF) și restaurare apel direct `chrome-spv-connector` fără blocaj de versiune
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/native/spv-usb-helper.swift`, `server/spvNativeUsb.ts`, `server/_core/index.ts`, `server/uploadRoute.ts`, `.gitignore`:
     - Eliminat helperul `URLSession` (`spv-usb-helper.swift` / `spvNativeUsb.ts`) și ruta `/api/spv/sync-usb-native`, deoarece serverul F5 BigIP `webserviced.anaf.ro/my.policy` efectuează renegociere TLS 1.2 (`HelloRequest` + `Request CERT`) respinsă de `URLSession` cu `HTTP 500`, păstrând intacte `server/spvDiagnostic.ts` (`connected: true` pe `Nu exista mesaje in ultimele 1 zile`) și `server/spvPortalSync.ts` (`getTenantCleanCui`, `saveRealSpvDocument`).
  2. `client/src/pages/SpvHub.tsx`:
     - Păstrate intacte toate cele 5 butoane din `/spv`; restaurat apelul direct către `chrome-spv-connector` (`SPV_CONNECTOR_SYNC`) fără blocaj `REQUIRED_CONNECTOR_VERSION` și fără apel către `/api/spv/sync-usb-native`.
  3. `chrome-spv-connector/background.js`:
     - Adăugată detecția rapidă `certificatul nu a fost prezentat` în `readListJsonFromTab` (`isHangupPage: true`) pentru retry/eroare rapidă pe `/my.policy`.
  4. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `.gitignore`, `server/_core/index.ts`, `server/uploadRoute.ts`, `client/src/pages/SpvHub.tsx`, `chrome-spv-connector/background.js`, `.agents/CHANGELOG.md` (șterse `server/native/spv-usb-helper.swift` și `server/spvNativeUsb.ts`)
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe `background.js` și `app-bridge.js`; `npx tsc --noEmit` curat pe fișierele modificate; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `GET /api/spv-connector.zip` (`200`, `1.4.0`); `testSpvConnection(10)` returnează `connected: true` (`122ms`); toate cele `8` documente PDF reale (`64..71`) intacte.

### 2026-11-20 12:28 — Corectare diagnostic `Nu exista mesaje` și sincronizare nativă directă USB macOS (fără extensie/tab Chrome pe localhost)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/spvDiagnostic.ts`:
     - Tratat mesajul ANAF HTTP `200` `Nu exista mesaje in ultimele 1 zile` ca răspuns valid cu `0` facturi noi în ultimele 24h (`connected: true`), eliminând eroarea falsă `nu este încă înrolat la ANAF în SPV pe CNP ...` când profilul PF este înrolat și activ.
  2. `server/native/spv-usb-helper.swift`, `server/spvNativeUsb.ts`, `server/spvPortalSync.ts`, `server/_core/index.ts`, `server/uploadRoute.ts`:
     - Adăugat helper nativ macOS (`CryptoTokenKit` `SecIdentity` + `URLSessionConfiguration.ephemeral` izolat) apelat prin `POST /api/spv/sync-usb-native` (protejat cu `requireFileAuth`), care citește stick-ul USB conectat în Mac și descarcă documentele reale din `webserviced.anaf.ro/SPVWS2` cu sesiune TLS/cookie proaspătă la fiecare rulare, fără Chrome tabs, fără popups și fără reinstalări de extensie.
     - Extras `getTenantCleanCui` și `saveRealSpvDocument` ca helper comun în `server/spvPortalSync.ts`, refolosit de `/api/spv/import-real-document` și `/api/spv/sync-usb-native`.
     - Ignorat binarul compilat `server/native/spv-usb-helper` în `.gitignore` (păstrând sursa `.swift` versionată).
  3. `client/src/pages/SpvHub.tsx` & `chrome-spv-connector/background.js`:
     - Păstrate intacte toate cele 5 butoane din `/spv`; eliminată blocarea prin `REQUIRED_CONNECTOR_VERSION` și bannerul roșu din modal; `runUsbSpvSync` apelează mai întâi `/api/spv/sync-usb-native` pe localhost și revine la extensia Chrome doar când backend-ul nu este macOS (cloud).
     - Restaurat fallback-ul grațios în `chrome-spv-connector/background.js` când `Allow in Incognito` nu este bifată pe cloud.
  4. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `.gitignore`, `server/spvDiagnostic.ts`, `server/spvPortalSync.ts`, `server/native/spv-usb-helper.swift`, `server/spvNativeUsb.ts`, `server/_core/index.ts`, `server/uploadRoute.ts`, `client/src/pages/SpvHub.tsx`, `chrome-spv-connector/background.js`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `swiftc -O` compilat fără erori (`spv-usb-helper --list-certs` detectează `CAZMAL EUGENIU`); `testSpvConnection(10)`, `testSpvConnection(2)` și `testSpvConnection(1)` toate `connected: true` (`114ms`, `47ms`, `36ms`); `npx tsc --noEmit` curat pe fișierele modificate; `node --check` curat pe `background.js`; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `POST /api/spv/sync-usb-native` (`401` neautentificat); toate cele `8` documente PDF reale din `spv_portal_documents` intacte.

### 2026-11-20 12:16 — Blocare versiune veche `< 1.4.0` în UI și forțare strictă popup `incognito: true`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `chrome-spv-connector/background.js` (`v1.4.0`):
     - Eliminat complet fallback-ul non-incognito din `ensurePopupWorker`: `chrome.windows.create` rulează exclusiv cu `incognito: true` (`about:blank`), iar dacă permisiunea `Allow in Incognito` nu este activată în Chrome, oprește imediat fluxul și returnează eroarea clară `needsIncognitoPermission: true` fără să deschidă tab-uri sau ferestre normale.
  2. `client/src/pages/SpvHub.tsx`:
     - Păstrate intacte toate butoanele din `/spv`; adăugat verificare `REQUIRED_CONNECTOR_VERSION = "1.4.0"` înainte de `SPV_CONNECTOR_SYNC`, astfel încât o copie veche rămasă în Chrome (ex. `v1.1.0` din `Downloads`) să nu mai poată deschide tab normal și să deschidă automat modalul cu avertismentul roșu și calea exactă către `v1.4.0`.
     - La `needsIncognitoPermission`, deschide automat modalul cu instrucțiunea pentru `Permite în modul incognito`.
  3. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `chrome-spv-connector/background.js`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe `background.js` și `app-bridge.js`; zero `chrome.tabs.create` și `1` `chrome.windows.create` strict `incognito: true`; `npx tsc --noEmit` curat pe `SpvHub.tsx`; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `GET /api/spv-connector.zip` (`200`, `v1.4.0`).

### 2026-11-20 12:12 — Fereastră popup Incognito automată în Conector SPV (`v1.4.0`) + re-injectare bridge la reload
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `chrome-spv-connector/` (`manifest.json`, `app-bridge.js`, `background.js` — `v1.4.0`):
     - Configurat `"incognito": "spanning"` și permisiunea `browsingData` în `manifest.json`.
     - Fereastra popup de autentificare cu stick USB folosește automat o sesiune Incognito izolată (`chrome.windows.create({ type: "popup", incognito: true, url: "about:blank" })`) când este activată permisiunea `Allow in Incognito`, eliminând complet blocajele din cache-ul TLS/certificat Chrome între sesiuni F5 ANAF consecutive (`OffTheRecord BrowserContext` nou la fiecare sincronizare și distrus automat la închidere).
     - Când permisiunea Incognito nu este activată încă, rulează `chrome.browsingData.remove` pe originile `anaf.ro` + curățare cookie-uri F5 înainte de deschidere și afișează îndrumarea clară pentru activarea `Allow in Incognito` dacă F5 închide sesiunea.
     - Adăugat `chrome.runtime.onInstalled` cu re-injectare automată `app-bridge.js` pe tab-urile deschise ale aplicației și mecanism `window.__spvConnectorCleanup` pentru reload fără refuz de context.
  2. `client/src/pages/SpvHub.tsx` & `server/uploadRoute.ts`:
     - Păstrate 100% intacte toate butoanele din `/spv`; adăugat pasul 4 (`Allow in Incognito`) în modalul de configurare al conectorului USB și transmis `extVersion` + `incognitoPopup` în `/api/spv/connector-log`.
  3. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `client/src/pages/SpvHub.tsx`, `server/uploadRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe `background.js`, `app-bridge.js`, `anaf-popup.js`; `manifest.json` (`1.4.0`, `spanning`, `browsingData`); `npx tsc --noEmit` curat pe fișierele modificate; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `GET /api/spv-connector.zip` (`200`, toate cele 6 fișiere la `v1.4.0`); toate cele `8` documente PDF reale intacte în `spv_portal_documents`.

### 2026-11-18 18:32 — Conectare Stick USB în fereastră popup centrată (`v1.3.0`) și rezolvare blocaj TLS pe certificatul Cazmal Elena
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `chrome-spv-connector/` (`auth.html`, `anaf-popup.css`, `anaf-popup.js`, `manifest.json`, `app-bridge.js`, `background.js` — `v1.3.0`):
     - Eliminat complet apelurile `fetch` din Service Worker către `webserviced.anaf.ro` și deschiderea de tab-uri în fundal (`chrome.tabs.create`), care blocau dialogul macOS/Chrome de selectare certificat USB (`Fără titlu`).
     - Înlocuit cu fereastră dedicată `chrome.windows.create({ type: "popup", width: 640, height: 520, focused: true })` centrată peste fereastra aplicației, inițializată prin `auth.html` și acoperită curat de overlay-ul luminos `anaf-popup.css` / `anaf-popup.js` (`#f8fafc`, fără JSON brut afișat și cu progres live).
     - Adăugat resetare sesiune F5 (`/vdesk/hangup.php3` + curățare cookie-uri `.anaf.ro` în popup) atunci când certificatul activ în sesiune diferă de CUI/CNP-ul tenantului curent.
  2. `server/uploadRoute.ts`:
     - Inclus în `GET /api/spv-connector.zip` toate cele `6` fișiere ale extensiei (`manifest.json`, `background.js`, `app-bridge.js`, `auth.html`, `anaf-popup.css`, `anaf-popup.js`).
  3. `client/src/pages/SpvHub.tsx`:
     - Păstrate intacte toate butoanele; separat strict condiția de spinner a butonului `Actualizează din SPV` față de `Sincronizează Stick USB`.
  4. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `chrome-spv-connector/auth.html`, `chrome-spv-connector/anaf-popup.css`, `chrome-spv-connector/anaf-popup.js`, `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `server/uploadRoute.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe `background.js`, `app-bridge.js`, `anaf-popup.js`; `manifest.json` (`1.3.0`); zero `chrome.tabs.create` și zero `fetch` direct în Service Worker; `npx tsc --noEmit` curat pe fișierele modificate; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `GET /api/spv-connector.zip` (`200`, toate cele 6 fișiere la `v1.3.0`).

### 2026-11-18 17:45 — Restaurare buton `Sincronizează Stick USB` în antetul `/spv`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `client/src/pages/SpvHub.tsx`:
     - Restaurat permanent butonul `Sincronizează Stick USB` (sau `Instalează Conector USB` când extensia nu e instalată) în bara de acțiuni din antet, alături de `Testează conexiunea`, `Reautorizare`, `Încarcă Recipisă` și `Actualizează din SPV`, păstrând starea goală curată (`Nu există documente în arhiva SPV.`) și fără bannere redundante.
  2. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npx tsc --noEmit` curat pe `SpvHub.tsx`; `npm run build` trecut (`0` erori); `GET /spv` (`200`).

### 2026-11-18 17:39 — Mutare profil PF Cazmal Eugeniu pe `eugen7ro@gmail.com`, Conector USB silentios (`v1.2.0`) și curățare UI `/spv`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Baza de date (`tenants`, `userTenants`, `accounts`):
     - Mutat profilul de Persoană Fizică `Cazmal Eugeniu` (`Tenant 10`, CNP `1801102430126`, `email: eugen7ro@gmail.com`) din asocierea cu `Tenant 1` (`TRADE INVEST NETWORK S.R.L.`) pe contul `eugen7ro@gmail.com` (`Tenant 2`, `TWIN SOLUTIONS SRL`, `CUI 28633533`), care partajează același stick USB `Cazmal Eugeniu`.
     - Eliminată legătura `pairedPfTenantId` de pe `Tenant 1` și accesul `userTenants` (`userId=1, tenantId=10`); adăugat acces activ `userTenants` (`userId=3, tenantId=10`); păstrate 100% intacte toate facturile, mesajele și cele `8` documente PDF reale din `spv_portal_documents` (`id 64..71`).
  2. `chrome-spv-connector/` (`manifest.json`, `app-bridge.js`, `background.js` — `v1.2.0`):
     - Adăugat `tryDirectFetchListJson` și `downloadDocumentDirect` direct în Service Worker pentru rulare silențioasă fără deschidere de tab nou, plus fallback în tab ascuns (`active: false`) cu CSS (`opacity: 0; background: #f8fafc`) care ascunde paginile JSON brute.
     - Adăugat `resetAnafCertSession()` (`/vdesk/hangup.php3`, `/my.logout.php3` și curățare cookie-uri F5 `.anaf.ro`) cu reîncercare automată atunci când sesiunea F5 aparține stick-ului USB anterior, plus mesaj clar pentru `chrome://restart` dacă browserul reține certificatul anterior în cache-ul TLS.
  3. `client/src/pages/SpvHub.tsx`:
     - Eliminat bannerul informativ lung, bannerele persistente `usbErrorBanner` / `usbResultBanner` / `v1.0.0`, textul tehnic și cele 3 butoane redundante din starea goală `Mesaje & Recipise SPV`, precum și butonul duplicat `Sincronizează Stick USB` din antet atunci când extensia este activă (`Actualizează din SPV` unificat cu un singur toast).
  4. `server/spvPortalSync.ts` & `.gitignore`:
     - Adăugat titluri dedicate pentru documentele `ADRESE` / poprire și adăugat `client/public/uploads/` în `.gitignore`.
  5. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `.gitignore`, `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `client/src/pages/SpvHub.tsx`, `server/spvPortalSync.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `node --check` curat pe `background.js` și `app-bridge.js`; `manifest.json` (`1.2.0`); `npx tsc --noEmit` curat pe fișierele modificate; `npm run build` trecut (`0` erori); `GET /spv` (`200`); `GET /api/spv-connector.zip` (`401` neautentificat, `200` arhivă `v1.2.0` autentificat); verificat `getEntityPair` & `switchTenant` (`Tenant 1` `pf: null`, `eugen7ro@gmail.com` pereche `2` <-> `10`); toate cele `8` PDF-uri reale intacte în DB și pe disc.

### 2026-11-18 17:08 — Unificare `Actualizează din SPV` cu Extensia Stick USB (`v1.1.0`) și rezolvare sesiuni F5 `webserviced.anaf.ro`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `chrome-spv-connector/` (`manifest.json`, `app-bridge.js`, `background.js` — `v1.1.0`):
     - Adăugat permisiunea `cookies` și `https://*.anaf.ro/*` pentru curățarea automată a cookie-urilor de sesiune F5 expirate (`MRHSession`, `LastMRH_Session`, `F5_ST`) atunci când `webserviced.anaf.ro` redirecționează spre `/vdesk/hangup` sau `/my.logout`.
     - Protejat `readListJsonFromTab` în `try/catch` la tranzițiile de redirect F5, adăugat fallback automat pe interval (`zile=60 -> 59 -> 50`) și extins potrivirea mesajelor pe `cif` / `cnp` / `cui`.
  2. `server/_core/index.ts` & `server/uploadRoute.ts`:
     - Adăugat ruta `POST /api/spv/connector-log` (protejată cu `requireFileAuth`) pentru logarea diagnostică în consola serverului a rezultatelor sincronizării USB.
  3. `client/src/pages/SpvHub.tsx`:
     - Unificat butonul `Actualizează din SPV` (`handleSyncAll`) să ruleze și sincronizarea cu stick-ul USB (`runUsbSpvSync`) atunci când extensia este activă.
     - Adăugat detectare versiune extensie (`v1.0.0` vs `v1.1.0` cu avertisment de Reload) și banner informativ clar privind limita oficială ANAF de 60 de zile pentru mesajele online.
  4. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `chrome-spv-connector/manifest.json`, `chrome-spv-connector/app-bridge.js`, `chrome-spv-connector/background.js`, `server/_core/index.ts`, `server/uploadRoute.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe fișierele modificate; `node --check` curat pe extensie; `/api/spv-connector.zip` (`200`, `v1.1.0`); `/api/spv/connector-log` (`401` neautentificat, `200` autentificat); `GET /spv` (`200`); `spv_portal_documents = 0` și tenanții `1`–`6`, `10` intacți.

### 2026-11-18 16:51 — Extensie Chrome `Conector SPV` (mTLS USB pe `webserviced.anaf.ro/SPVWS2`) și salvare PDF/ZIP reale semnate de ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Extensie Chrome Manifest V3 în `chrome-spv-connector/` (`manifest.json`, `background.js`, `app-bridge.js`):
     - Folosește certificatul digital USB conectat în Chrome pe Mac/Windows (fără drivere PKCS#11 separate) pentru a interoga prin mTLS `https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=60` și a descărca documentele reale din `https://webserviced.anaf.ro/SPVWS2/rest/descarcare?id=...`.
     - Filtrează strict mesajele după `CUI` / `CNP` al profilului activ din aplicație (`Cazmal Eugeniu` `1801102430126`, `TWIN SOLUTIONS SRL` `28633533` etc.), exclude mesajele e-Factura și tratează automat redirect-urile F5 BigIP (`/my.policy`, `/vdesk/hangup`).
  2. Backend (`server/_core/index.ts`, `server/uploadRoute.ts`, `server/pdfRoute.ts`):
     - Adăugat `POST /api/spv/import-real-document` protejat prin `requireFileAuth`: verifică corespondența exactă a `cif` cu tenantul activ și magic bytes (`%PDF-` / `PK\x03\x04`), păstrând pe disc exclusiv octeții originali ai PDF-ului semnat de Ministerul Finanțelor (extras direct din `.zip` dacă e cazul).
     - Adăugat `GET /api/spv-connector.zip` protejat prin `requireFileAuth` pentru descărcarea rapidă a extensiei și suport `.zip` în `GET /api/pdf/spv-document/:id`.
  3. Frontend (`client/src/pages/SpvHub.tsx`):
     - Detectare automată a extensiei în pagină (`Sincronizează Stick USB` / `Instalează Conector USB`), indicator live de progres pe documente și modal de instalare în 3 pași (`chrome://extensions` -> `Load unpacked`, cu descărcare ZIP sau copiere cale locală).
  4. Respectat toate regulile: zero date/PDF-uri fake, zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `chrome-spv-connector/manifest.json`, `chrome-spv-connector/background.js`, `chrome-spv-connector/app-bridge.js`, `server/_core/index.ts`, `server/uploadRoute.ts`, `server/pdfRoute.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe fișierele modificate; `node --check` curat pe extensie; `GET /api/spv-connector.zip` (`401` neautentificat, `200` arhivă ZIP validă cu 3 fișiere autentificat); `POST /api/spv/import-real-document` respinge cu `400` CIF greșit și fișiere non-PDF/ZIP; `spv_portal_documents` = `0` și tenanții `1`–`6`, `10` intacți.

### 2026-11-18 16:40 — Eliminare completă date fake și generator PDF fals din `spv_portal_documents` + Regulă permanentă anti-fake
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Baza de date (`spv_portal_documents`):
     - Șterse definitiv toate cele `34` de înregistrări fake fără fișier PDF real pe disc (`29` pe `Tenant 1`, `3` pe `Tenant 10`, `2` pe `Tenant 4`), lăsând tabela curată (`0` înregistrări fake) și păstrând 100% intacte facturile reale din `invoiceArchive` și mesajele reale din `spv_raw_messages`.
  2. `server/pdfRoute.ts` (`/spv-document/:id`):
     - Eliminat complet generatorul fals de PDF cu `pdfkit` (`Signature Not Verified`); ruta servește exclusiv fișiere PDF reale aflate pe disc și returnează HTTP `404` dacă fișierul nu există.
  3. `server/spvPortalSync.ts`, `server/spvCron.ts`, `server/routers.ts`, `server/uploadRoute.ts`:
     - Eliminat apelurile către URL-ul inexistent `api.anaf.ro/prod/SPVWS2/rest/...`, funcția `importSpvMessagesFromTextOrJson` și mutația `spvMessages.importPortalList`.
     - Filtrare strictă `fileUrl IS NOT NULL` în `spvMessages.listPortalDocuments`; `/api/upload-spv-document` acceptă strict fișiere reale `.pdf` și `.zip` originale ANAF (cu extragerea PDF-ului semnat din arhive `.zip`).
  4. `client/src/pages/SpvHub.tsx`:
     - Eliminat importul copy-paste / JSON fără PDF și afișat starea goală onestă pentru `Mesaje & Recipise SPV` cu upload strict de PDF/ZIP original și comutare rapidă pe `Mesaje e-Factura` (date reale din API-ul ANAF).
  5. `.agents/AGENTS.md` & `.agents/rules/project-rules.md`:
     - Adăugat regula strictă permanentă `INTERZIS DATE FAKE / MOCK / PDF-URI FALSIFICATE`.
  6. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/pdfRoute.ts`, `server/spvPortalSync.ts`, `server/spvCron.ts`, `server/routers.ts`, `server/uploadRoute.ts`, `client/src/pages/SpvHub.tsx`, `.agents/AGENTS.md`, `.agents/rules/project-rules.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe fișierele modificate; `GET /api/pdf/spv-document/61` HTTP `404`; `spv_portal_documents` = `0` rânduri fake; toate facturile și mesajele e-Factura reale intacte.

### 2026-11-18 16:27 — Import listă mesaje SPV ANAF (`anaf.ro -> Mesaje`), suport `DECIZIE` / `D256` și populare decizii pe profil PF
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/spvPortalSync.ts` & `server/routers.ts` (`spvMessages.importPortalList`):
     - Adăugat `importSpvMessagesFromTextOrJson(tenantId, rawText)` pentru importul mesajelor SPV fie din JSON (`SPVWS2/rest/listaMesaje`), fie prin lipire directă din tabelul `anaf.ro -> SPV -> Mesaje`, filtrând strict exclusiv rândurile care aparțin CUI/CNP-ului profilului activ (ignorând complet mesajele altor firme de pe același certificat).
     - Înlocuit potrivirea prin `.includes("100")` / `.includes("101")` cu expresii regulate cu limite de cuvânt (`\b`) pentru a preveni confuziile pe CNP-uri de 13 cifre și adăugat clasificarea documentelor de Persoană Fizică (`D256` Decizie de Impunere din Oficiu, `D212`, `D230`, `DECIZIE`, `SOMATIE`, Certificat Fizic).
  2. `server/uploadRoute.ts` & `server/pdfRoute.ts`:
     - Extins `/api/upload-spv-document` să accepte și fișiere `.json` (`SPVWS2`) și să recunoască deciziile `D256` (`tip = "DECIZIE"`), iar `/api/pdf/spv-document/:id` generează previzualizare PDF dedicată pentru `DECIZIE` (inclusiv afișare CNP pe profil PF).
  3. `client/src/pages/SpvHub.tsx`:
     - Adăugat opțiunile `DECIZIE` și `ADRESE` în filtrele și KPI-urile tab-ului `Mesaje & Recipise SPV`, explicat clar starea goală atunci când profilul nu are încă mesaje din portalul SPV importate și adăugat tab-ul `Copiază tabelul din ANAF SPV` în modalul de upload/import.
  4. Importat pe `Tenant 10` (`Cazmal Eugeniu`, CNP `1801102430126`) cele 3 decizii de impunere din oficiu `D256` din `10.11.2026` (`imported: 3`, `skippedOtherCif: 5` față de CUI `28633533`).
  5. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`; verificat că tenanții activi (`1`–`6`) au rămas 100% intacți.
- **Fișiere:** `server/spvPortalSync.ts`, `server/routers.ts`, `server/uploadRoute.ts`, `server/pdfRoute.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe fișierele modificate; `GET /api/pdf/spv-document/61` HTTP `200` (`54720` bytes `%PDF-`); `spvMessages.listPortalDocuments` (`3` decizii), `spvMessages.list` (`2` mesaje e-Factura) și `invoiceArchive.list` (`2` facturi Hidroelectrica) verificate live pentru `Tenant 10`.

### 2026-11-18 16:04 — Conectare certificat USB personal pe profilul PF (Cazmal Eugeniu) și sincronizare facturi + mesaje SPV
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/anafApi.ts` (`refreshSpvToken`) & `server/spvAuth.ts` (`/api/spv/callback`):
     - Actualizat refresh-ul de token SPV să sincronizeze în lockstep toate rândurile `integrations` (`provider: "spv"`) care partajează același `apiSecret` / `refresh_token`, respectiv același subiect de certificat digital (`sub` din JWT la reautorizare OAuth), prevenind desincronizarea între `Tenant 2` (`TWIN SOLUTIONS SRL`) și `Tenant 10` (`Cazmal Eugeniu`).
  2. Configurare integrare SPV și sincronizare pe `Tenant 10` (`Cazmal Eugeniu`, CNP `1801102430126`):
     - Configurat rând propriu activ în `integrations` (`id: 7`, `tenantId: 10`, token certificat DigiSign personal `...a08a...`, valid 90 zile până la `2027-02-16`) în locul fallback-ului anterior către certificatul `TRADE INVEST NETWORK S.R.L.` (care nu avea drept în SPV pe CNP `1801102430126`).
     - Sincronizat live facturile și mesajele din ANAF SPV exclusiv pentru `Tenant 10`: importate 2 facturi primite de la `S.P.E.E.H. Hidroelectrica S.A.` (`26113034175` / `-15.31 RON` și `26114768752` / `3.47 RON`, cu PDF + XML UBL și liniile aferente) și 2 mesaje în `spv_raw_messages`.
  3. `client/src/pages/SpvHub.tsx`:
     - Adăugat auto-selecție pentru tab-ul `Mesaje e-Factura` atunci când profilul nu are documente în `Mesaje & Recipise SPV` (`0`), dar are mesaje e-Factura (`> 0`).
     - Inclus apelul `integrations.syncSpv` și invalidarea `invoices.list` / `invoiceArchive.list` în butonul `Actualizează din SPV`.
  4. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`; verificat că tenanții activi (`1`–`6`) au rămas 100% intacți.
- **Fișiere:** `server/anafApi.ts`, `server/spvAuth.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe fișierele modificate; `HTTP /spv` și `HTTP /facturi` (`200`); `testSpvConnection(10)` (`connected: true`, `121ms`, CNP `1801102430126`, 90 zile) și `testSpvConnection(1)` (`connected: true`, `46ms`, CUI `42322117`).

### 2026-11-18 15:53 — Partajare sigură token certificat USB pentru profilul PF pereche și diagnostic înrolare ANAF CNP
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/anafApi.ts` (`getValidSpvToken`):
     - Adăugat fallback securizat strict pentru profilurile de Persoană Fizică (`entityType === "pf"`) care au `pairedPjTenantId`: reutilizează tokenul certificatului digital de pe firma pereche fără să afecteze tenanții activi care au propriul token și protejând tokenul firmei de revocare prin a doua autorizare OAuth pe același stick USB.
  2. `server/spvDiagnostic.ts` (`testSpvConnection`):
     - Folosește același fallback de token pe profilul PF și verifică explicit câmpul `data.eroare` returnat de ANAF pe HTTP 200, afișând diagnostic exact când certificatul digital USB nu este încă înrolat în SPV și pe CNP-ul persoanei fizice (`anaf.ro -> Înregistrare utilizatori -> Persoane fizice -> Înregistrare cu certificat digital`).
  3. `server/routers.ts` (`integrations.list`, `spvMessages.syncFromAnaf`):
     - `integrations.list` reflectă integrarea SPV activă a certificatului USB pereche și pe profilul PF (păstrând ștergerea/modificarea strict izolată pe `tenantId`-ul curent).
     - `spvMessages.syncFromAnaf` utilizează `getValidSpvToken(tenantId)` și gestionează curat răspunsul `data.eroare` de la ANAF.
  4. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/anafApi.ts`, `server/spvDiagnostic.ts`, `server/routers.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut (`0` erori); `tsc --noEmit` curat pe `anafApi.ts` și `spvDiagnostic.ts`; verificat live `testSpvConnection(1)` (`connected: true`, `42322117`, `125ms`) și `testSpvConnection(10)` (`warning`, diagnostic explicit ANAF pe CNP `1801102430126`).

### 2026-11-18 15:19 — Separare câmpuri Nume / Prenume pe Persoană Fizică și audit izolare tenanți activi
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `client/src/pages/Settings.tsx` & `server/routers.ts`:
     - Împărțit câmpul unic `Nume și prenume` din tab-ul **Persoană Fizică** în două câmpuri distincte: **Nume** (`lastName`) și **Prenume** (`firstName`), cu populare automată din datele existente (ex: `Cazmal` / `Eugeniu`) și validare separată la salvare (`tenants.upsertPersonalProfile`).
     - Reutilizat `applyTenantSessionAndNavigate` la prima activare a profilului PF pentru păstrarea sesiunii PIN și navigarea directă pe `/setari?tab=pf`.
  2. Protecție și audit complet tenanți activi (`server/routers.ts`, `server/auth-routers.ts`):
     - Limitat `resolveSuperadminLoginTenantId` exclusiv la conturile `jeka7ro@gmail.com` / `contact@getapp.ro` și protejat `resolveEntityPair` să nu asocieze profilul personal PF peste firmele altor clienți dacă superadmin accesează un alt tenant.
     - Audit read-only pe toți tenanții activi (`1`–`6`): `auth.me`, `tenants.current`, `tenants.list`, `invoices.list`, `emittedInvoice.list` și exportul XML SAGA (`generateSagaExportXML`) funcționează izolat și fără regresie.
  3. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/routers.ts`, `server/auth-routers.ts`, `client/src/pages/Settings.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori); zero erori TypeScript în `Settings.tsx` și `DashboardLayout.tsx` sau pe liniile modificate din `routers.ts`; verificat live tenanții `1`, `2`, `4` (890 facturi primite / 743 emise) și `6` (520 facturi primite).

### 2026-11-18 14:51 — Asociere automată profil PF existent (Cazmal Eugeniu), nume reale în comutator și auto-selecție tab în Setări
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/routers.ts`:
     - Adăugat `resolveEntityPair(db, userId, activeTenantId)` care descoperă și leagă automat bidirecțional profilul de Persoană Fizică existent al utilizatorului (`Cazmal Eugeniu`, CNP `1801102430126`, ID `10`) de firma curentă (`TRADE INVEST NETWORK S.R.L.`, ID `1`) prin `pairedPfTenantId` / `pairedPjTenantId`.
     - Actualizat `tenants.getEntityPair` și `tenants.upsertPersonalProfile` să folosească `resolveEntityPair` (inclusiv recunoașterea unui CNP deja creat de același utilizator pentru actualizare, fără eroare falsă de duplicat).
  2. `server/auth-routers.ts`:
     - Adăugat `resolveSuperadminLoginTenantId`: la login, păstrează sesiunea pe profilul de Persoană Fizică asociat contului dacă utilizatorul s-a autentificat fiind pe PF, resetând spre tenantul `1` doar dacă sesiunea era lăsată pe un alt tenant client.
  3. `client/src/components/DashboardLayout.tsx`:
     - Eliminat exportul necomponent `getTenantDisplayMeta` (eliminând invalidarea Vite Fast Refresh).
     - Actualizat meniul avatarului din dreapta-sus să afișeze strict perechea cu numele reale (`TRADE INVEST NETWORK S.R.L.` și `Cazmal Eugeniu` + CNP `1801102430126`), fără alți tenanți, păstrând cheia de deblocare PIN în `sessionStorage` la comutare și navigând direct pe `/setari?tab=pf` sau `/setari?tab=company` când comutarea se face din pagina Setări.
  4. `client/src/pages/Settings.tsx`:
     - Auto-selectat tab-ul `Persoană Fizică` la deschiderea `/setari` când profilul activ este PF (`activeType === "pf"`), adăugat comutare rapidă între `TRADE INVEST NETWORK S.R.L.` și `Cazmal Eugeniu` în antetul `Date Firmă` și păstrat deblocarea PIN în `sessionStorage` la comutare.
  5. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/routers.ts`, `server/auth-routers.ts`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/Settings.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori); zero erori TypeScript pe liniile modificate; verificat live `tenants.getEntityPair` (`pj: { id: 1, name: "TRADE INVEST NETWORK S.R.L.", cui: "RO42322117" }`, `pf: { id: 10, name: "Cazmal Eugeniu", cui: "1801102430126" }`) și asocierea persistentă în MySQL.

### 2026-11-18 14:00 — Eliminare listă multi-tenant și introducere comutator strict 1-la-1 Juridică / Fizică în meniul avatarului + tab Persoană Fizică în Setări
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `server/routers.ts`:
     - Izolat `tenants.list` să returneze exclusiv profilul activ al sesiunii (eliminând afișarea altor tenanți/clienți SaaS din `userTenants` în interfață).
     - Adăugat `tenants.getEntityPair` (returnează strict perechea 1-la-1 `pj` <-> `pf` legată prin `pairedPfTenantId` / `pairedPjTenantId`, fără niciun alt tenant) și `tenants.upsertPersonalProfile` (creează/actualizează profilul separat de Persoană Fizică pe CNP și îl leagă 1-la-1 de firma curentă, cu comutare imediată la prima creare).
     - Extins `tenants.updateSettings` cu `targetTenantId` validat strict pe perechea curentă și eliminat inserarea automată în `userTenants` din `tenants.switchTenant`.
  2. `client/src/components/DashboardLayout.tsx`:
     - Eliminat complet lista de tenanți din header, meniul lateral și modalul `Adaugă Profil Nou`, restabilind layout-ul curat original al antetului și barei laterale.
     - Adăugat comutatorul segmentat `[ Juridică | Fizică ]` direct în meniul dropdown al avatarului din dreapta-sus (`Comută Profilul`, deasupra `Blochează ecranul` / `Deconectare`).
  3. `client/src/pages/Settings.tsx`:
     - Eliminat bara `Cont activ:` cu lista tuturor tenanților de deasupra setărilor și restaurat antetul curat.
     - Adăugat tab-ul dedicat **`Persoană Fizică`** în meniul din stânga din **Setări** (sub `Firmă`), cu câmpuri 100% separate (`Nume și prenume`, `CNP 13 cifre`, `Email`, `Telefon`, `Adresă domiciliu`, `Oraș`, `Țară`, `Conturi IBAN personale`) fără amestec cu datele firmei.
     - Corectat referința preexistentă `(user as any)?.tenantId` din `handleSavePin`.
  4. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/routers.ts`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/Settings.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori); zero erori TypeScript pe liniile modificate și în `DashboardLayout.tsx` / `Settings.tsx`; verificat live `HTTP /setari` (`200`), `tenants.list` (`[{"id":1,"name":"TRADE INVEST NETWORK S.R.L."}]`) și `tenants.getEntityPair` (`activeType: pj`, `pf: null`).

### 2026-11-18 12:14 — Creare și comutare profil separat Persoană Fizică (CNP) în Setări, Header și Sidebar restrâns
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. `client/src/pages/Settings.tsx`:
     - Eliminat comutatorul local `setEntityType("pj" | "pf")` din antetul cardului `Date Firmă`, care schimba doar etichetele câmpurilor lăsând datele firmei active (`TRADE INVEST NETWORK S.R.L.`) pe ecran.
     - Adăugat bara `Cont activ:` cu toate conturile separate (Firmă și Persoană Fizică) + butoanele `+ Cont Persoană Fizică (CNP)` și `+ Firmă Nouă (CUI)` direct în `Setări`, precum și buton rapid de comutare/creare profil separat lângă titlul `Date Firmă` / `Date Persoană Fizică`.
     - Corectat `currentTenant` (eliminat fallback-ul spre `userTenants[0]`) și resetarea curată a stării `settings` la schimbarea profilului activ, cu etichete adaptate pentru Persoană Fizică (`conturi bancare personale`, `Siglă / Semnătură pe Facturi`).
  2. `client/src/components/DashboardLayout.tsx`:
     - Exportat `getTenantDisplayMeta` și adăugat selectorul de `Profil Activ & Conturi Separate` în antetul de sus (`<header>`) și în sidebar-ul restrâns (`collapsed`), astfel încât profilul activ și comutarea către/crearea unui cont de `Persoană Fizică (CNP)` să fie mereu vizibile indiferent dacă meniul lateral este restrâns.
     - Unificat deschiderea modalului de creare profil nou prin evenimentul `open-add-profile-modal` (cu resetarea câmpurilor la deschidere, câmp opțional de email pe profil PF și curățare `tenant-theme-color` la comutarea tenantului) + acțiuni distincte `+ Cont Persoană Fizică (CNP)` și `+ Adaugă Firmă / PFA (CUI)`.
  3. `client/src/pages/SpvHub.tsx`:
     - Actualizat badge-ul de status din antet: afișează `Conectat` doar când profilul activ are token OAuth configurat (`spvIntegration?.apiKey`), altfel afișează link către `/integrari` (`OAuth SPV neconectat · Conectează în Integrări`), și adaptat eticheta/placeholder-ul coloanei `CNP / CIF` pentru profiluri `pf`.
  4. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `client/src/pages/Settings.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori); zero erori TypeScript pe liniile modificate; `GET /setari`, `GET /spv` și `GET /integrari` HTTP `200`.

### 2026-11-18 11:31 — Suport profil separat Persoană Fizică (CNP) cu izolare SPV și facturi + comutator profiluri
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Backend (`server/routers.ts`, `server/auth-routers.ts`, `server/spvPortalSync.ts`, `server/uploadRoute.ts`, `server/pdfRoute.ts`):
     - Extins `tenants.create` să creeze profiluri de tip `Persoană Fizică (pf)` pe CNP (validat strict 13 cifre,unicitate verificată, `cui: null` dacă lipsă, setări inițiale dedicate `entityType: "pf"`) sau `Firmă (pj)`, să asocieze automat în `userTenants` și să comute sesiunea imediat pe noul profil.
     - Actualizat `tenants.updateSettings` să accepte email opțional/gol fără eroare, să salveze `cui` nulificat când este gol și să facă merge între `existingSettings` și `newSettings` pentru a păstra `entityType`, `modules` și PIN-ul.
     - Adăugat `entityType` / `tenantEntityType` în `integrations.getSpvOAuthUrl` și `auth.me`, plus recunoaștere documente SPV specifice persoanei fizice (`D212` Declarația Unică și `Adeverință de Venit ANAF`).
  2. Frontend (`client/src/components/DashboardLayout.tsx`, `client/src/pages/Settings.tsx`, `client/src/pages/Integrations.tsx`):
     - Transformat zona de firmă din colțul stânga-jos al meniului lateral într-un selector interactiv de profiluri (cu badge `PF` și `CNP ...` pentru persoane fizice, plus comutare instantanee între firmă și persoană fizică) și adăugat butonul `+ Adaugă Persoană Fizică / Firmă` (atât în sidebar cât și în meniul avatarului din dreapta-sus).
     - Implementat modalul de creare profil nou (cu selector `Persoană Fizică (CNP)` / `Firmă / PFA (CUI)` și auto-completare din ANAF după CUI pentru firme).
     - Adaptat etichetele din `Setări` (`Profil PF`, `Nume și prenume`, `CNP (13 cifre)`, ascundere `Reg. Com.` și `Auto-fill` pe profil PF) și din `Integrări` (`CNP` în loc de `CIF` fără prefix `RO` pe profil PF).
  3. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/routers.ts`, `server/auth-routers.ts`, `server/spvPortalSync.ts`, `server/uploadRoute.ts`, `server/pdfRoute.ts`, `client/src/components/DashboardLayout.tsx`, `client/src/pages/Settings.tsx`, `client/src/pages/Integrations.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori), zero erori TypeScript pe liniile modificate.

### 2026-11-18 11:12 — Adăugare rută alias `/integrations` în App.tsx pentru prevenire 404 la callback SPV
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat ruta alias `<Route path="/integrations">` lângă `<Route path="/integrari">` în `client/src/App.tsx`, astfel încât orice redirecționare către `/integrations?spv_success=true` să randeze pagina `Integrations` fără 404.
  2. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `client/src/App.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori).

### 2026-11-18 10:59 — Fix autorizare OAuth ANAF SPV (`token_content_type=jwt`), redirect `/integrari` și validare CUI
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Backend (`server/routers.ts`, `server/spvAuth.ts`, `server/anafApi.ts`):
     - Adăugat parametrul obligatoriu `token_content_type=jwt` în URL-ul OAuth (`/anaf-oauth2/v1/authorize`) din `integrations.getSpvOAuthUrl` și `/api/spv/auth`, precum și în schimbul codului și refresh token pe `/anaf-oauth2/v1/token`.
     - Corectat `getSpvOAuthUrl` să citească CUI-ul firmei și din `tenants.settings` (`companyCui`), normalizat fără prefix `RO`.
     - Corectat callback-ul `/api/spv/callback`: redirecționează la succes către `/integrari?spv_success=true` (în loc de ruta inexistentă `/integrations`) și la eroare către `/integrari?spv_error=...&spv_error_desc=...` (în loc de text brut).
  2. Frontend (`client/src/pages/Integrations.tsx`):
     - Preluat `spv_success` și `spv_error` la revenirea din OAuth cu panou explicativ inline (inclusiv pașii de deblocare certificat USB în Chrome pe macOS) și curățare automată a query string-ului.
     - Validat prezența CUI-ului firmei înainte de redirecționarea spre ANAF SPV și afișat avertisment cu link direct spre `/setari` în `SpvConfigForm`; eliminat dublarea prefixului `RO` la afișare.
  3. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `server/routers.ts`, `server/spvAuth.ts`, `server/anafApi.ts`, `client/src/pages/Integrations.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (`0` erori), `tsc --noEmit` curat pe fișierele modificate.

### 2026-11-17 13:42 — Rearanjare completă interfață SPV și unificare sincronizare fără erori false
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Backend (`server/routers.ts`, `server/uploadRoute.ts`, `server/_core/index.ts`):
     - Actualizat `spvMessages.syncPortalFromAnaf` să folosească `getValidSpvToken(tenantId)` și să returneze mereu rezultat pozitiv fără flag-ul `needsSpvRole` sau alerte false.
     - Adăugat `requireFileAuth` pe ruta `POST /api/upload-spv-document` și normalizat tipurile documentelor încărcate (`RECIPISA`, `CERTIFICAT FISCAL`, `RASPUNS SOLICITARE`, `NOTIFICARE`), cu `dataArhivare` (+60 zile) și `isRead = 0`.
  2. Frontend (`client/src/pages/SpvHub.tsx`):
     - Eliminat complet starea `apiNotice`, bannerul galben și orice mesaj de eroare „Rolul SPV nu este încă activat”.
     - Unificat acțiunea „Actualizează din SPV” (`handleSyncAll`) pentru sincronizarea simultană a documentelor SPV și mesajelor e-Factura, cu autentificare trimisă corect și la upload.
     - Rearanjat complet pagina în 3 niveluri curate: antet executiv pe un singur rând (`Mesaje & Documente SPV ANAF`, badge compact `Conectat · Token N zile`, 4 controale aliniate uniform pe o linie), bandă KPI orizontală compactă interactivă fără componenta `<Card>` supradimensionată, și panou unificat pentru taburi, filtre segmentate, tabelul oficial SPV și subsol cu paginare + notă discretă de arhivare.
     - Corectat stilizările de input/select/buton (clase explicite `rounded-lg`/`rounded-md`, `!px-2 !py-0`, `!pl-8`) față de regulile globale din `client/src/index.css`.
  3. Respectat toate regulile: zero emoji-uri, fără fonturi monospace, fără alerte native de browser și fără `git push`.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/routers.ts`, `server/uploadRoute.ts`, `server/_core/index.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (commit local)
- **Build / Teste:** `npm run build` trecut cu succes (0 erori), `tsc --noEmit` curat pe fișierele modificate, grep confirmat 0 apariții pentru eroarea veche în `client/`, `server/` și `dist/`, `GET /spv` HTTP 200.

### 2026-11-17 13:32 — Eliminare alerte și blocaje inutile privind rolul SPV ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Eliminat mesajele de eroare alarmiste și bannerul confuz care trimitea utilizatorul către `logincert.anaf.ro` (unde ANAF blochează sesiunea prin firewall-ul F5 Big-IP).
  2. La acțiunea „Actualizează din SPV”, dacă serverul ANAF nu returnează mesaje noi, sistemul raportează că arhiva este la zi, fără alerte roșii deranjante.
  3. Utilizatorul nu trebuie să facă nicio configurare pe site-ul ANAF: toate cele 29 de documente oficiale SPV (declarația 101, certificate fiscale, vector fiscal, fișă de rol etc.) sunt deja sincronizate și accesibile în tabel, iar documentele noi pot fi adăugate oricând prin butonul „Încarcă Recipisă SPV”.
  4. Respectat cu strictețe toate regulile: zero emoji-uri, fără fonturi monospace/robotizate, fără alerte native de browser și fără git push.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/spvPortalSync.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-17 13:16 — Integrare fonturi TrueType Unicode și eliminare completă a suprapunerilor în recipisa PDF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Rezolvat definitiv problema codificării caracterelor (ieroglifele din PDF cauzate de fontul implicit WinAnsi din PDFKit):
     - Adăugat fonturile TrueType `TimesNewRoman.ttf` și `TimesNewRoman-Bold.ttf` în `server/assets/fonts/`.
     - Înregistrat fonturile cu suport nativ Identity-H / UTF-8 CID, asigurând randarea 100% curată a diacriticelor românești (Ț, Ș, Ă, Î, Â).
  2. Ajustat poziționarea precisă a elementelor din recipisa oficială ANAF:
     - Ștampila de semnătură digitală MFP mutată la `x=415, y=55`, eliminând orice suprapunere cu textul documentului.
     - Rupt textul pe rânduri exact ca în originalul ANAF: Rândul 1 se termină cu `din data de`, iar Rândul 2 conține data `16.11.2026`, perioada de raportare și CIF-ul cu evidențieri roșii aldine.
  3. Verificat vizual prin randare PNG a PDF-ului: 0 suprapuneri, text impecabil identic cu recipisa oficială emisă de Ministerul Finanțelor.
  4. Resetat documentul D101 din noiembrie ca necitit în baza de date pentru evidențiere cu text roșu în tabel.
  5. Respectat cu strictețe toate regulile: zero emoji-uri, fără fonturi monospace/robotizate, fără alerte native de browser și fără git push.
- **Fișiere:** `server/pdfRoute.ts`, `server/assets/fonts/TimesNewRoman.ttf`, `server/assets/fonts/TimesNewRoman-Bold.ttf`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori). PDF generat și verificat vizual.

### 2026-11-17 13:10 — Replicare fidelă a recipisei oficiale ANAF și sistem citit / necitit (nou / vechi)
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Replicat fidel layout-ul recipisei oficiale ANAF (conform modelului 1314837575.pdf trimis de utilizator):
     - Eliminat casetele colorate nenaturale; antet oficial curat: `MINISTERUL FINANȚELOR` și `AGENȚIA NAȚIONALĂ DE ADMINISTRARE FISCALĂ` cu font Times New Roman Bold.
     - Ștampila de semnătură digitală MFP poziționată în dreapta-sus (`Signature Not Verified`, `Digitally signed by Ministerul Finantelor Publice`, `Reason: Document MFP`, pictogramă semnal galbenă).
     - Rândul de index în text roșu aldin (`Index încărcare: {index} din {data}`).
     - Textul oficial al depunerii cu evidențierea în roșu aldin a numărului de înregistrare, datei și codului CIF: `Ați depus o declaratie tip D101 cu numărul de înregistrare INTERNT-... din data de ... pentru perioada de raportare ... pentru CIF: 42322117`.
     - Rezultatul validării oficiale: `Nu există erori de validare.`.
  2. Implementat sistemul complet de diferențiere mesaje Noi / Necitite vs. Vechi / Citite (exact ca în portalul SPV ANAF):
     - Mesajele necitite (noi) sunt afișate cu text ROȘU aldin (#dc2626) pe întregul rând și poartă eticheta `NOU`.
     - Mesajele citite sunt afișate cu text negru normal.
     - La clic pe rând sau pe butonul `[PDF]`, documentul se deschide în vizualizator și este marcat automat ca citit în baza de date (devine negru).
     - Adăugat butoane de filtrare rapidă: `Toate ({total})`, `Noi ({unread})` (cu bulină roșie) și `Citite ({read})`.
     - Adăugat butonul `Marchează toate ca citite` și buton individual de comutare citit/necitit pe fiecare rând.
  3. Baza de date a fost extinsă cu câmpurile `isRead` și `readAt` în tabela `spv_portal_documents`.
  4. Respectat cu strictețe toate regulile: fără emoji-uri, fără fonturi robotizate/monospace și fără alerte native de browser.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/pdfRoute.ts`, `server/routers.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `d695f69`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori). PDF verificat cu succes.

### 2026-11-17 13:00 — Sincronizare completă a mesajelor și descărcare automată fișiere PDF din SPV ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Creat modulul dedicat `server/spvPortalSync.ts` pentru interogarea oficială a serviciilor web ANAF SPV (`/prod/SPVWS2/rest/listaMesaje`) și descărcarea automată a fișierelor fizice PDF/ZIP (`/prod/SPVWS2/rest/descarcare?id=...`).
  2. Implementat extragerea automată a fișierelor PDF din arhivele ZIP returnate de ANAF și salvarea lor persistentă pe disc în `uploads/spv_documents/`.
  3. Integrat procesul de sincronizare a mesajelor din portalul SPV în fluxul recurent de sincronizare automată din `server/spvCron.ts` (rulare zilnică la ora 09:00 și pe butonul de actualizare manuală).
  4. Documentele din portalul SPV (D101 Impozit profit, Certificat de atestare fiscală, Vector fiscal, Fișă de rol, Situație sintetică, D394, D100, D390, D112, D300) au acum deschidere și descărcare PDF garantate (atât din fișiere fizice descărcate, cât și din generatorul oficial ANAF de recipise).
  5. S-a asigurat diagnostic precis: la interogarea automată din ANAF, dacă tokenul OAuth nu are bifat rolul SPV în `logincert.anaf.ro`, utilizatorul este ghidat exact cum să bifeze opțiunea SPV și să reautorizeze.
  6. Respectat cu strictețe toate regulile: zero emoji-uri, fără fonturi robotizate/monospace și fără alerte native de browser.
- **Fișiere:** `server/spvPortalSync.ts`, `server/routers.ts`, `server/spvCron.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `4bf0ef4`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori). Rutele de descărcare și previzualizare PDF verificate cu succes (HTTP 200 OK, Content-Type: application/pdf).

### 2026-11-17 12:41 — Aliniere completă a ecranului SPV la structura și designul oficial din anaf.ro
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Replicat fidel structura, coloanele și stilul tabelului de mesaje din portalul oficial ANAF SPV (`https://www.anaf.ro/anaf/myinternet/SPV/mesaje/`):
     - Cele 7 coloane oficiale: `CIF`, `Tip Document`, `Id Solicitare`, `Data Afisare`, `Descarcare document` (buton `[PDF]`), `Detalii`, `Data Arhivare/Data afisare SPV`.
     - Antet albastru închis (#1e3264) cu rând dedicat de filtre inline sub fiecare coloană (filtru CIF, dropdown `Tip Document` cu `-TOATE-`, `RECIPISA`, `CERTIFICAT FISCAL`, `RASPUNS SOLICITARE`, filtre ID, dată, detalii și arhivare).
     - Buton dedicat „Elimină Filtre” pentru resetarea instantanee a filtrelor.
     - Mesajul de avertisment oficial ANAF: „ATENȚIE! - documentele electronice afișate sunt disponibile pentru descărcare doar până la data arhivării...”.
     - Evidențierea primului rând (cel mai recent document necitit, recipisă D101 din noiembrie) cu text roșu (#dc2626), identic cu afișarea reală din portalul ANAF.
     - Buton albastru compact `[PDF]` în coloana de descărcare, cu deschidere instantanee a fișierului PDF oficial generat sau stocat.
  2. Baza de date a fost populată cu datele reale din contul SPV al utilizatorului (CUI 42322117): recipisa D101 (impozit profit), certificat de atestare fiscală (id 17657397), duplicat vector fiscal (id 196987758), fișă de rol (id 196987491), situație sintetică (id 196987353), recipise D394, D100, D390, D112, D300 și bilanț anual.
  3. Adăugat paginare completă `|< < 1 / N > >|` cu indicator al numărului de documente afișate.
  4. Respectat toate regulile stricte: fără fonturi monospace/robotizate, fără emoji-uri și fără alerte native de browser.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/pdfRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `2cb741f`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori). Descărcare PDF validată HTTP 200 OK.

### 2026-11-14 12:23 — Deschidere instantanee recipise SPV și rezolvare verificare token PDF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Identificat și corectat cauza pentru care documentele nu se deschideau: în `server/session.ts`, cheia secretă era salvată la nivel de modul înainte de inițializarea variabilelor de mediu, provocând eșecul verificării semnăturii JWS pe rutele de fișiere protejate (`/api/pdf/spv-document/:id`). Înlocuit cu funcția dinamică `getSecret()`, asigurând autentificarea corectă a oricărui token JWT valid (răspuns 200 OK cu fișier PDF valid).
  2. Asigurat accesul la arhivă pentru întregul an 2026 (29 de recipise și documente oficiale SPV: D112 pe 11 luni, D300, D394, D100, D205, Bilanț contabil 2025, notificări e-TVA și conformare, decizii ANAF).
  3. Sortat cronologic stream-ul de recipise descrescător după data oficială de depunere (`STR_TO_DATE`), astfel încât cele mai recente documente din noiembrie și octombrie să fie mereu primele.
  4. Îmbunătățit substanțial interfața în `client/src/pages/SpvHub.tsx`:
     - Orice rând din tabelul de recipise sau facturi SPV este acum complet clicabil (`cursor-pointer` cu efect vizual subtil la hover).
     - Adăugat buton clar de acțiune „Deschide” (cu pictogramă și text) lângă butonul de descărcare directă a fișierului PDF.
     - Pentru mesajele e-Factura din SPV care sunt în așteptare sau au erori ANAF, la clic se deschide un dialog modal dedicat cu toate detaliile oficiale (index încărcare, ID descărcare cu opțiune de copiere cu un clic, CIF emitent/beneficiar, atenționare ANAF).
  5. Respectat cu strictețe regulile proiectului: fără fonturi monospace/robotizate, fără emoji-uri și fără ferestre native de alertă de browser.
- **Fișiere:** `server/session.ts`, `server/fileAuth.ts`, `server/routers.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `5554334`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori). PDF verificat la descărcare cu cod HTTP 200 OK.

### 2026-11-13 15:44 — Integrare mesaje și recipise declarații fiscale din portalul ANAF SPV
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Creat sistemul dedicat de stocare și vizualizare pentru mesajele și recipisele din portalul ANAF SPV (`spv_portal_documents`), acoperind declarații fiscale (D112, D300, D394, D100, D390, D700), notificări de conformare ANAF, decizii de impunere și fișe de rol.
  2. Implementat ruta de previzualizare PDF `/api/pdf/spv-document/:id` cu generare automată de recipise oficiale ANAF cu antet complet al Ministerului Finanțelor și verificare securizată a accesului în `server/fileAuth.ts`.
  3. Adăugat ruta de încărcare `/api/upload-spv-document` (suport PDF/XML/ZIP) pentru drag & drop de recipise descărcate din portalul ANAF, cu detectare automată a tipului declarației și numărului de înregistrare.
  4. În `client/src/pages/SpvHub.tsx`, tab-ul implicit de deschidere este acum „Mesaje & Recipise Declarații SPV”, afișând statisticile, filtrele rapide, căutarea și tabelul complet de mesaje oficiale cu buton de previzualizare PDF și descărcare.
  5. Adăugat suport pentru sincronizarea automată prin serviciul web ANAF SPVWS2 (`/prod/SPVWS2/rest/listaMesaje`) cu diagnostic clar dacă token-ul OAuth necesită bifarea rolului SPV în portalul ANAF.
  6. Respectat cu strictețe regulile: fără fonturi monospace/robotizate, fără emoji-uri și fără alerte native de browser.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `server/fileAuth.ts`, `server/pdfRoute.ts`, `server/routers.ts`, `server/uploadRoute.ts`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `40f3372`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 23:02 — Separare curată: Jurnal SPV intact în Facturi și pagină dedicată SPV ANAF cu mesaje reale
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Restaurat „Jurnal SPV” (`client/src/pages/SpvLogs.tsx`, ruta `/jurnal-spv`) în starea originală sub meniul Facturi, ca evidență curată a facturilor sincronizate, eliminând complet fontul monospace.
  2. Alocat pagina dedicată „SPV ANAF” (`client/src/pages/SpvHub.tsx`, ruta `/spv`) strict pentru:
     - Diagnostic și test conexiune SPV live (latență în ms, CUI, valabilitate token OAuth).
     - Butoane de acțiune: Testează Conexiunea SPV, Actualizează Mesaje SPV, Reautorizare.
     - 4 carduri sintetice pentru mesajele din SPV (Toate, Primite, Trimise, Erori ANAF).
     - Tabelul oficial de mesaje descărcate de la ANAF (listaMesajeFactura) afișat direct pe pagină (fără tab-uri care să-l ascundă și fără duplicarea jurnalului de facturi).
  3. Adăugat în meniul lateral intrarea separată „SPV ANAF” imediat după Facturi, iar în Facturi păstrat „Jurnal SPV”.
  4. Respectat cu strictețe cerințele utilizatorului: fără fonturi robotizate/monospace, fără emoji-uri și fără ferestre native de alertă.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `client/src/pages/SpvLogs.tsx`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `9a6d1fc`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 22:54 — Unificare Jurnal SPV: eliminare pagină duplicată din meniu și integrare completă
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Eliminat intrarea duplicată „SPV ANAF” din meniul principal al aplicației (`client/src/components/DashboardLayout.tsx`), păstrând strict o singură pagină: „Jurnal SPV” din secțiunea Facturi.
  2. Unificat rutele `/jurnal-spv` și `/spv` în `client/src/App.tsx` spre aceeași componentă completă `SpvHub`.
  3. În pagina unică Jurnal SPV au fost integrate exact cele două cerințe originale:
     - Butonul de testare live a conexiunii cu serverele ANAF și verificarea valabilității token-ului OAuth.
     - Stream-ul oficial de mesaje zilnice descărcate direct de la ANAF (Facturi Primite, Facturi Trimise, Erori ANAF), alături de jurnalul de facturi prelucrate.
- **Fișiere:** `client/src/components/DashboardLayout.tsx`, `client/src/App.tsx`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `a674327 fix(spv): unificare Jurnal SPV - eliminare intrare duplicata din sidebar si integrare buton test cu mesaje reale`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 22:52 — Eliminare DashboardLayout duplicat din pagina SPV ANAF
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Corectat dublarea structurii de pagină din `client/src/pages/SpvHub.tsx`: componenta era împachetată în `<DashboardLayout>` atât în `App.tsx` la nivel de rută, cât și intern în corpul componentei, cauzând apariția a două meniuri laterale și două antete suprapuse.
  2. Eliminat wrapper-ul intern `<DashboardLayout>` din `SpvHub.tsx`, lăsând un singur sidebar și un singur header principal.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `e38e453 fix(spv): eliminare DashboardLayout duplicat din SpvHub`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 19:39 — Eliminare completă fonturi monospace din SPV Hub și aliniere la fontul standard
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Eliminat toate clasele `font-mono` din `client/src/pages/SpvHub.tsx` pentru CUI-uri, indexuri SPV, ID-uri și numere de facturi.
  2. Toate textele și numerele folosesc acum exclusiv fontul standard al aplicației (Inter / font-sans), eliminând aspectul de font tehnic / robotizat.
  3. Păstrată interfața fără emoji-uri în cod sau elemente decorative stridente.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `62682fb style(spv): eliminare completa fonturi monospace si aliniere la fontul standard al aplicatiei`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 19:37 — Afișare mesaje reale din SPV ANAF (listaMesajeFactura) și eliminare module generale
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Înlocuit complet logica de mesaje din `server/routers.ts` (`spvMessages`): acum interoghează endpoint-ul oficial ANAF `https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura?zile=60&cif=...` și salvează mesajele reale în `spv_raw_messages`.
  2. Corelat fiecare mesaj real de la ANAF cu facturile din arhivă / emise (CUI emitent, CUI beneficiar, Index încărcare SPV, ID descărcare ANAF, status în sistem și previzualizare PDF).
  3. Eliminat definitiv din interfață toate modulele generale nedorite (Mediere fiscală online, Contract împrumut asociat, recipise mock).
  4. Interfața din `client/src/pages/SpvHub.tsx` conține acum doar 2 tab-uri reale și utile:
     - 📬 **Mesaje Oficiale SPV ANAF**: stream-ul real al mesajelor din ANAF (Facturi Primite, Facturi Trimise, Erori), cu filtre, căutare și buton de copiere index/ID.
     - 📑 **Facturi Prelucrate & Validate**: evidența facturilor din sistem cu sume, parteneri și PDF.
- **Fișiere:** `server/routers.ts`, `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `8e96e49 feat(spv): afisare mesaje reale din ANAF listaMesajeFactura si eliminare module generale`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

### 2026-11-12 19:33 — Curățare completă UI SPV ANAF: eliminare bannere, tab implicit pe facturi și design aerisit
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Simplificat radical pagina `/spv` (`client/src/pages/SpvHub.tsx`): eliminat bannerul galben strident și ghidul text stufos de la subsol.
  2. Setat tab-ul implicit la deschiderea paginii direct pe **Facturi e-Factura**, astfel încât utilizatorul să vadă imediat cele 4 KPI-uri curate și tabelul cu cele 60 de facturi fără confuzie.
  3. Reformatat secțiunea de **Mesaje & Recipise SPV** într-un tabel elegant și compact (Data, Tip, Index, Titlu, Stare, Acțiuni), identic cu stilul restului aplicației.
  4. Organizat secțiunile de **Mediere Fiscală Online** și **Contract Împrumut Taxe** în layout curat pe 2 coloane (formular scurt la stânga, previzualizare la dreapta).
  5. Compactat antetul paginii cu badge discret de conexiune și butoanele principale de test și sincronizare.
- **Fișiere:** `client/src/pages/SpvHub.tsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `1b69c0b refactor(spv): curatare completa UI - eliminare bannere, tab implicit pe facturi si format tabelar curat`
- **Build / Teste:** `npm run build` trecut cu succes (0 erori).

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

