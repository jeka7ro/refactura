# Matt Pocock Engineering, Superpowers Workflow & Anthropic Document Skills

Acest proiect aplică permanent disciplinele de arhitectură, domeniu, TDD, code review și procesare de documente din:
- **`mattpocock/skills`:** `codebase-design`, `improve-codebase-architecture`, `domain-modeling`, `grill-with-docs`, `grill-me`, `mattpocock-tdd`, `code-review`, `diagnosing-bugs`, `to-spec`, `writing-for-agents`
- **`obra/superpowers`:** `test-driven-development`, `dispatching-parallel-agents`, `writing-plans`, `executing-plans`, `requesting-code-review`, `receiving-code-review`, `systematic-debugging`, `verification-before-completion`
- **`anthropics/skills`:** `pdf`, `xlsx`, `docx`, `frontend-design`, `webapp-testing`

## Reguli aplicate în proiect

1. **Deep Modules & Seam Discipline (`codebase-design` + `improve-codebase-architecture`):**
   - Construiește module adânci (*deep modules*): ascunde complexitatea fiscală, de conversie valutară BNR, de extracție PDF/XML/MT940 și de autentificare multi-tenant în spatele unor interfețe mici, pure și ușor de testat.
   - Evită duplicarea calculelor (ex: conversia `EUR`/`USD`/`GBP`/`CHF` → `RON` sau validarea căilor `/uploads/...` cu prefixul `t${tenantId}-`) în mai multe locuri fără o interfață clară.

2. **Limbaj Ubikuu al Domeniului (`domain-modeling` + `GLOSSARY.md`):**
   - Respectă și actualizează `GLOSSARY.md` ori de câte ori apare un concept nou de domeniu fiscal/contabil (ex: *Factură Externă / Non-SPV*, *Extras de Cont*, *Echivalent RON BNR*, *Tenant PJ/PF*, *Portal Contabil*), păstrând glosarul strict conceptual (fără detalii de implementare).

3. **TDD pe Logică Fiscală, Parsere și Izolare Multi-Tenant (`mattpocock-tdd` + `test-driven-development`):**
   - Pentru parsere de facturi/extrase, generatoare XML UBL/SAGA, calcule TVA/valutare și gărzi de securitate multi-tenant, scrie și rulează teste automate deterministe (`vitest`) pe cazuri reale (inclusiv valori negative/storno, valute străine, cotă TVA `0%` și încercări cross-tenant).

4. **Standard de Calitate pentru Documente PDF, Excel și Word (`pdf` + `xlsx` + `docx`):**
   - **PDF:** Nu genera niciodată PDF-uri false/imitate pentru documente oficiale ANAF sau fișiere externe încărcate — servește întotdeauna fișierul original de pe disc (`streamFileSafely` cu verificare `tenantId`), iar pentru generările interne (`pdfkit`) asigură diacritice românești corecte și logo-ul real al tenantului.
   - **Excel (`.xlsx`):** Setează lățimi explicite pe coloane (`!cols`) ca să nu apară valori trunchiate (`#####`), include moneda originală + echivalentul RON la cursul BNR acolo unde există facturi în valută și verifică absența erorilor de formulă.
   - **Word (`.docx`):** Limitează dimensiunea dezarhivării (`zip-bomb` protection) și păstrează structura paragrafelor/clauzelor la importul contractelor.

5. **Code Review & Execuție Paralelă (`code-review`, `requesting-code-review`, `dispatching-parallel-agents`):**
   - Înainte de finalizarea unei funcționalități multi-fișier, verifică modificările prin lentila de securitate multi-tenant, acuratețe contabilă și consistență Apple HIG Light/Dark Mode, respectând fără excepție regulile stricte ale proiectului (fără `git push` necerut, fără `alert()`/`confirm()`/`prompt()`, fără date mock/fake).
