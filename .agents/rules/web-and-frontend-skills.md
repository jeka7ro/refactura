---
trigger: always_on
---
# Web Interface & Frontend Design Skills (`vercel-labs/agent-skills` + `anthropics/skills`)

Pentru orice creare, modificare sau audit de interfață web, componente React, tabele, filtre, modale sau ecrane mobile/Kiosk, aplică regulile din:
- `.agents/skills/web-design-guidelines/SKILL.md` și `.agents/skills/web-design-guidelines/references/command.md` (`vercel-labs/agent-skills` + `vercel-labs/web-interface-guidelines`)
- `.agents/skills/frontend-design/SKILL.md` (`anthropics/skills`)
împreună cu `.agents/skills/apple-design/SKILL.md`:

1. **Geometrie fără overflow și suport multi-limbă:** pune `min-width: 0` (`min-w-0`) pe copiii flex/grid și `truncate` / `break-words` pe texte, astfel încât barele de filtre, tabelele și traducerile să nu depășească niciodată lățimea ecranului (`scrollWidth <= clientWidth`).
2. **iOS Safari, Mobil și Ecrane Tactile (HoReCa / Kiosk / Portal):** evită auto-zoom-ul iOS Safari pe câmpurile de formular pe mobil (`font-size >= 16px`), folosește `touch-action: manipulation`, `overscroll-behavior: contain` în modale/drawers și ținte tactile clare (`36–44px`), plus `font-variant-numeric: tabular-nums` pe toate sumele, prețurile, TVA-ul și contoarele.
3. **Consistență vizuală și regulile stricte ale proiectului:** verifică întotdeauna atât **Light Mode**, cât și **Dark Mode**, respectă culoarea dinamică a tenantului (`var(--tenant-theme-color)`) pe taburile/filtrele active, nu folosi niciodată `alert()` / `confirm()` / `prompt()` și nu șterge/ascunde butoane existente fără cerere explicită.
