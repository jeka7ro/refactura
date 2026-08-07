import React from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{title}</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Anulează
          </button>
          <button 
            onClick={onConfirm} 
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
          >
            Confirmă ștergerea
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDeleteWrapper({ 
  onConfirm, 
  title = "Confirmare ștergere", 
  message = "Ești sigur că vrei să ștergi acest element?",
  children 
}: { 
  onConfirm: () => void;
  title?: string;
  message?: string;
  children: (openModal: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <>
      {children(() => setIsOpen(true))}
      <ConfirmModal
        isOpen={isOpen}
        title={title}
        message={message}
        onCancel={() => setIsOpen(false)}
        onConfirm={() => {
          onConfirm();
          setIsOpen(false);
        }}
      />
    </>
  );
}
