export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-sm rounded-2xl border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Termeni și Condiții (T&C)</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-500 mb-8">Ultima actualizare: {new Date().toLocaleDateString('ro-RO')}</p>
          
          <h2>1. Acceptarea Termenilor</h2>
          <p>
            Prin accesarea și utilizarea platformei noastre de facturare, sunteți de acord cu respectarea acestor Termeni și Condiții. Dacă nu sunteți de acord cu orice prevedere, vă rugăm să nu folosiți serviciile noastre.
          </p>

          <h2>2. Responsabilitățile Utilizatorului</h2>
          <p>
            Utilizatorul este singurul responsabil pentru acuratețea datelor financiare și a facturilor introduse și emise prin intermediul platformei. Platforma acționează doar ca un instrument tehnic și nu oferă consultanță fiscală sau contabilă.
          </p>

          <h2>3. Funcționarea Serviciului și SPV ANAF</h2>
          <p>
            Ne străduim să menținem o disponibilitate tehnică cât mai ridicată. Totuși, transmiterea facturilor către e-Factura depinde de funcționarea sistemelor naționale ANAF. Nu ne asumăm răspunderea pentru întârzierile cauzate de infrastructura tehnică de stat.
          </p>

          <h2>4. Limitarea Răspunderii</h2>
          <p>
            Serviciul este furnizat "așa cum este" ("as is"). Nu ne asumăm răspunderea pentru niciun fel de pierderi financiare, pierderi de profit, sau sancțiuni fiscale suferite de dumneavoastră ca urmare a folosirii incorecte a aplicației sau a întreruperilor tehnice.
          </p>
          
          <h2>5. Politica de Rambursare (Refund)</h2>
          <p>
            Pentru plățile recurente tip abonament SaaS, sumele debitate pentru luna în curs nu sunt rambursabile. Utilizatorii își pot anula abonamentul în orice moment, anularea având efect la sfârșitul perioadei curente de facturare.
          </p>
        </div>
      </div>
    </div>
  );
}
