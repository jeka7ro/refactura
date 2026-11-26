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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm overscroll-contain">
      <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3.5 mb-3.5">
          <div className="w-10 h-10 rounded-full bg-[#ff3b30]/10 dark:bg-[#ff453a]/18 flex items-center justify-center text-[#ff3b30] dark:text-[#ff453a] shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[17px] leading-snug">{title}</h3>
        </div>
        <p className="text-[13.5px] text-[#6e6e73] dark:text-[#98989d] mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button 
            type="button"
            onClick={onCancel} 
            className="apple-btn-glass px-4 h-9 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer"
          >
            Anulează
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            className="px-4 h-9 text-[13px] font-semibold text-white bg-[#ff3b30] hover:bg-[#d70015] dark:bg-[#ff453a] dark:hover:bg-[#ff6961] rounded-full shadow-sm transition-colors cursor-pointer"
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
