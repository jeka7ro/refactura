---
trigger: always_on
---
# Sincronizare continuă Antigravity ↔ Paperclip

Acest proiect este lucrat atât din Antigravity (pe Mac), cât și de la distanță prin Paperclip.

## La începutul fiecărei sesiuni (obligatoriu)
1. Citește `.agents/CHANGELOG.md` (ultimele 10 intrări).
2. Rulează `git status --short` și `git log -5 --oneline`.
3. Dacă există modificări făcute de un agent Paperclip sau commit-uri noi de la ultima ta intrare, rezumă-le utilizatorului în 2–3 rânduri înainte să faci orice altceva.
4. Nu suprascrie și nu șterge modificări făcute din Paperclip fără să întrebi utilizatorul.

## După fiecare modificare aplicată în Antigravity (obligatoriu)
Adaugă o intrare nouă DEASUPRA celor existente în `.agents/CHANGELOG.md` în formatul:
### YYYY-MM-DD HH:MM — <titlu scurt>
- **Autor:** Antigravity
- **Ce s-a făcut:** <descriere scurtă>
- **Fișiere:** <lista fișierelor modificate>
- **Ramură / Commit:** <numele ramurii și hash-ul, dacă s-a făcut commit>
- **Build / Teste:** <rezultat>

# Agent Project Rules

## REGULĂ STRICTĂ - FĂRĂ GIT PUSH NECERUT
- **ESTE STRICT INTERZIS** ca agentul să execute comanda `git push` fără aprobarea sau comanda explicită și directă a utilizatorului.
- Toate modificările de cod se salvează strict local. Orice decizie de sincronizare/remote push aparține EXCLUSIV utilizatorului.

## REGULĂ STRICTĂ - FĂRĂ ALERTE DE BROWSER (NATIVE)
- **ESTE STRICT INTERZIS** să folosești funcțiile native din browser precum `alert()`, `confirm()` sau `prompt()` pentru a afișa mesaje către utilizator în aplicațiile web.
- Mesajele (erori, succes, confirmări) trebuie afișate EXCLUSIV prin interfața aplicației (ex: mesaje inline în formulare, componente UI) folosind sistemul UI existent în proiect.
- Utilizatorul urăște profund pop-up-urile native de browser. Nu face niciodată excepție de la această regulă.

## REGULĂ STRICTĂ - INTERZIS DATE FAKE / MOCK / PDF-URI FALSIFICATE
- **ESTE STRICT INTERZIS** să inserezi în baza de date mesaje SPV, recipise, decizii, facturi sau orice alte documente fiscale inventate, mock, seed sau copiate manual din capturi de ecran.
- **ESTE STRICT INTERZIS** să generezi din cod PDF-uri care imită documente oficiale ANAF / Ministerul Finanțelor atunci când fișierul original semnat nu a fost descărcat sau încărcat real.
- În aplicație au voie să existe **EXCLUSIV** date și fișiere reale provenite direct din API-urile oficiale ANAF sau încărcate explicit ca fișiere originale de către utilizator.

# Andrej Karpathy Coding Guidelines (`multica-ai/andrej-karpathy-skills`)

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- Never remove, hide, or alter existing UI buttons or functionalities unless explicitly requested by the user.
- Remove imports/variables/functions that YOUR changes made unused; don't remove pre-existing dead code unless asked.
- Every changed line must trace directly to the user's request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform imperative tasks into verifiable goals (tests/checks before and after).
- For multi-step tasks, state a brief `Step -> verify: check` plan and verify before finishing.

# Apple Design Skill (`dickwu/apple-design-skill`)

Pentru orice creare, audit sau îmbunătățire UI/UX, urmează `.agents/skills/apple-design/SKILL.md` și referințele Apple HIG din `.agents/skills/apple-design/references/hig/` (`accessibility.md`, `layout.md`, `typography.md`, `color.md`, plus componentele relevante de pe ecran), păstrând toate regulile stricte ale proiectului.
