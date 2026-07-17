export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 shadow-sm rounded-2xl border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Politica de Confidențialitate (GDPR)</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-500 mb-8">Ultima actualizare: {new Date().toLocaleDateString('ro-RO')}</p>
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-8">
            <strong>Atenție!</strong> Acesta este un text orientativ / placeholder. Trebuie să introduci aici politica ta reală de confidențialitate redactată de un avocat.
          </div>

          <h2>1. Ce date colectăm</h2>
          <p>
            [Explică aici ce date colectezi: nume, email, CUI firmă, date despre clienții introduși în aplicație, adrese IP pentru log-uri de securitate etc.]
          </p>

          <h2>2. Scopul prelucrării</h2>
          <p>
            [De ce colectezi aceste date? Ex: Pentru a putea emite facturi, pentru suport tehnic, pentru respectarea obligațiilor fiscale ale platformei.]
          </p>

          <h2>3. Cu cine partajăm datele</h2>
          <p>
            [Enumeră serviciile terțe folosite de tine: Ex: furnizor de hosting, furnizor de email-uri tranzacționale, procesatorul de plăți (Stripe/Netopia) etc.]
          </p>

          <h2>4. Drepturile tale (GDPR)</h2>
          <p>
            [Menționează clar că au dreptul la ștergerea contului (poate fi făcută din Setări) și exportul datelor lor.]
          </p>
        </div>
      </div>
    </div>
  );
}
