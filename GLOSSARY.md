# Smart Invoice — Glosar de Domeniu

Platformă multi-tenant de facturare electronică, gestiune, arhivare documente fiscale și colaborare în timp real cu contabilitatea pentru firme și persoane fizice din România.

## Organizare și Acces

**Tenant**:
O entitate juridică (**PJ**) sau persoană fizică (**PF**) izolată complet ca date, documente, serii de facturare, conexiuni fiscale și setări.
_Avoid_: Firmă generică, cont, workspace

**Cont Utilizator**:
Identitatea autentificată a unei persoane care poate accesa unul sau mai mulți **Tenanți** pe baza unei asocieri active și a unui rol (`admin`, `editor`, `viewer`, `superadmin`).
_Avoid_: Profil, client

**Portal Contabil**:
Spațiul securizat dedicat contabilului unui **Tenant**, accesat prin link unic și PIN, disponibil atât în vedere modernă, cât și în vedere clasică SAGA, din care contabilul consultă și descarcă **Facturi Primite**, **Facturi Emise**, **NIR**-uri și **Extrase de Cont**.
_Avoid_: Pagină publică, dashboard extern

## Documente Fiscale și Bancare

**Factură SPV**:
O factură electronică UBL transmisă sau recepționată prin sistemul național RO e-Factura (**SPV ANAF**), identificată unic prin **Index SPV** și păstrată împreună cu XML-ul original semnat.
_Avoid_: Factură manuală

**Factură Externă**:
O factură sau chitanță fiscală provenită din afara **SPV ANAF** (furnizori intracomunitari sau non-UE precum Google, Meta, OpenAI, AWS, Hetzner, ori documente interne non-SPV), încărcată ca fișier original (PDF, XML sau imagine) și inclusă integral în calculul lunar și în **Portalul Contabil**.
_Avoid_: Factură improvizată, ciornă

**Factură Emisă**:
Document fiscal de vânzare emis de **Tenant** către un **Partener** direct din platformă, ce poate fi transmis ulterior în **SPV ANAF**.
_Avoid_: Factură de intrare

**Re-Factură**:
Factură de vânzare generată pornind de la cheltuieli recepționate pe **Facturi SPV**, **Facturi Externe** sau **NIR**-uri, cu sau fără adaos comercial, către un **Partener** beneficiar.
_Avoid_: Storno

**Extras de Cont**:
Document bancar oficial (PDF, CSV, MT940, CAMT.053 XML sau XLSX) aferent unui cont IBAN și unei luni contabile a **Tenantului**, încărcat în arhivă și pus automat la dispoziția contabilului în **Portalul Contabil**.
_Avoid_: Chitanță, ordin de plată

## Gestiune și Valută

**NIR** *(Notă de Intrare Recepție)*:
Documentul de gestiune care atestă recepția cantitativă și valorică în stoc a mărfurilor sau materialelor de pe o **Factură SPV** sau **Factură Externă** de achiziție.
_Avoid_: Aviz

**Deviz**:
Document tehnico-financiar care grupează materialele și manopera aferente unei lucrări și stă la baza emiterii unei **Facturi Emise** sau a unui **Bon de Consum**.
_Avoid_: Ofertă simplă

**Bon de Consum**:
Documentul intern de scădere din gestiune a materialelor utilizate într-o lucrare sau pe un **Deviz**.
_Avoid_: Factură de ieșire

**Echivalent RON BNR**:
Valoarea în lei calculată prin convertirea sumelor exprimate în valută (`EUR`, `USD`, `GBP`, `CHF`) la cursul oficial de referință al Băncii Naționale a României, utilizată pentru totalurile lunare și rapoartele consolidate.
_Avoid_: Curs estimat manual
