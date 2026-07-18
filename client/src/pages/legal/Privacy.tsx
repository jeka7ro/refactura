export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 shadow-sm rounded-2xl border border-slate-200">
        <h1 className="text-3xl font-black text-slate-900 mb-6 px-4">Politică de Confidențialitate</h1>
        
        <div className="w-full h-[75vh] rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
          <iframe 
            src="https://www.iubenda.com/privacy-policy/14635596" 
            title="Privacy Policy"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
