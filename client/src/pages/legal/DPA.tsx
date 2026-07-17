export default function DPA() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 shadow-sm rounded-2xl border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Acord de Prelucrare a Datelor (DPA)</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-500 mb-8">Ultima actualizare: {new Date().toLocaleDateString('ro-RO')}</p>
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-8">
            <strong>Atenție!</strong> Acesta este documentul prin care tu garantezi în fața clienților tăi B2B că platforma ta este un mediu sigur pentru datele pe care EI le introduc (datele clienților lor). 
          </div>

          <h2>1. Părțile Implicate</h2>
          <p>
            Clientul tău acționează ca <strong>Operator de Date (Data Controller)</strong>, iar tu, platforma, acționezi ca <strong>Împuternicit (Data Processor)</strong>.
          </p>

          <h2>2. Ce facem cu datele</h2>
          <p>
            Noi prelucrăm datele EXCLUSIV în scopul prestării serviciului (generare facturi, comunicare SPV, trimitere email-uri), nu le vindem și nu le folosim în scopuri proprii de marketing.
          </p>

          <h2>3. Lista Sub-Împuterniciților (Sub-processors)</h2>
          <p>
            Pentru a putea rula platforma, folosim alți furnizori care pot avea acces limitat și securizat la date:
          </p>
          <ul>
            <li><strong>Amazon Web Services / Vercel / Render</strong> - Hosting și Baze de date</li>
            <li><strong>Stripe</strong> - Procesator de plăți (văd doar datele de card ale Clientului tău, nu și ale cumpărătorilor săi)</li>
            <li><strong>Resend / Mailgun</strong> - Trimitere de email-uri tranzacționale</li>
            <li><strong>ANAF (Sistemul RO e-Factura)</strong> - Pentru transmiterea facturilor în SPV</li>
          </ul>

          <h2>4. Măsuri de Securitate</h2>
          <p>
            Toate conexiunile sunt criptate SSL/TLS. Baza de date este criptată "at-rest". Realizăm backup-uri periodice pentru a preveni pierderea datelor.
          </p>
        </div>
      </div>
    </div>
  );
}
