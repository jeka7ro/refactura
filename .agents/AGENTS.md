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
