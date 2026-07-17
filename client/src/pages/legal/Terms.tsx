export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 shadow-sm rounded-2xl border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Termeni și Condiții (T&C)</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-500 mb-8">Ultima actualizare: {new Date().toLocaleDateString('ro-RO')}</p>
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-8">
            <strong>Atenție!</strong> Acesta este un text orientativ. Trebuie să introduci aici termenii reali de utilizare ai platformei Smart ERP.
          </div>

          <h2>1. Acceptarea Termenilor</h2>
          <p>
            [Explică faptul că folosirea aplicației implică acceptarea acestor reguli. Dacă nu sunt de acord, trebuie să nu mai folosească aplicația.]
          </p>

          <h2>2. Responsabilitățile Utilizatorului</h2>
          <p>
            [Menționează că e responsabilitatea lor să introducă date fiscale corecte și că tu, ca platformă, nu ești responsabil pentru erorile contabile pe care le fac ei.]
          </p>

          <h2>3. Plăți și Abonamente</h2>
          <p>
            [Regulile despre politica de refund (de obicei la SaaS B2B nu se dă refund pentru luni deja începute), anularea abonamentului și trial-ul gratuit.]
          </p>

          <h2>4. Limitarea Răspunderii (Limitation of Liability)</h2>
          <p>
            [Clauză esențială: Platforma funcționează "as is" (așa cum este). Dacă pică SPV-ul ANAF sau serverul tău e down 2 ore, clienții nu te pot da în judecată pentru pierderi de profit.]
          </p>
        </div>
      </div>
    </div>
  );
}
