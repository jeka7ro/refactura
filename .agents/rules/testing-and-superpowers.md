---
trigger: always_on
---
# Webapp Testing & Superpowers Engineering Discipline (`anthropics/skills` + `obra/superpowers`)

Aplică permanent disciplina inginerească și de verificare din:
- `.agents/skills/systematic-debugging/SKILL.md` (`obra/superpowers`)
- `.agents/skills/verification-before-completion/SKILL.md` (`obra/superpowers`)
- `.agents/skills/webapp-testing/SKILL.md` (`anthropics/skills`)

1. **`systematic-debugging` (Fără cârpeli la ghici):**
   - *Regula de fier:* Nicio modificare fără investigarea cauzei rădăcină întâi (`Phase 1: Root Cause Investigation` + `root-cause-tracing.md`).
   - Urmărește fluxul complet de date (DB → Backend / SPV / SAGA XML → UI) și izolează strict pe `tenantId` atunci când cerința vizează un anumit tenant. Dacă 3 încercări consecutive eșuează, oprește-te și discută arhitectura cu utilizatorul.
2. **`webapp-testing` (Verificare reală în browser și pe rezoluții mobile):**
   - După modificări de layout, bare de filtre, carduri KPI, modale sau ecrane mobile/Kiosk, verifică randarea reală în browser (subagentul `browser` / Chrome CDP / Playwright pe serverul local, salvând orice fișiere temporare exclusiv în workspace, niciodată în afara proiectului).
   - Verifică pe Desktop și pe lățimi de telefon (`320px`, `375px`, `390px`, `430px`), în Light Mode și Dark Mode (`getBoundingClientRect()`, `scrollWidth <= clientWidth`, `getComputedStyle()`), înainte de a confirma finalizarea.
3. **`verification-before-completion` (Dovezi înainte de afirmații):**
   - *Regula de fier:* Nu afirma niciodată că o sarcină este gata, că un bug este rezolvat sau că build-ul trece fără să fi rulat efectiv comanda de verificare (`npx tsc --noEmit`, `npm run build`, test pe date reale fără date fake/mock sau inspecție vizuală) în tura curentă și să fi confirmat rezultatul `0` erori.
