# Agent Project Rules

## REGULĂ STRICTĂ - FĂRĂ GIT PUSH NECERUT
- **ESTE STRICT INTERZIS** ca agentul să execute comanda `git push` fără aprobarea sau comanda explicită și directă a utilizatorului.
- Toate modificările de cod se salvează strict local. Orice decizie de sincronizare/remote push aparține EXCLUSIV utilizatorului.

## REGULĂ STRICTĂ - FĂRĂ ALERTE DE BROWSER (NATIVE)
- **ESTE STRICT INTERZIS** să folosești funcțiile native din browser precum `alert()`, `confirm()` sau `prompt()` pentru a afișa mesaje către utilizator în aplicațiile web.
- Mesajele (erori, succes, confirmări) trebuie afișate EXCLUSIV prin interfața aplicației (ex: mesaje inline în formulare, componente UI) folosind sistemul UI existent în proiect.
- Utilizatorul urăște profund pop-up-urile native de browser. Nu face niciodată excepție de la această regulă.
