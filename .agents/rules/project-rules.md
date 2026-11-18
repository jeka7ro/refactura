---
trigger: always_on
---
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

