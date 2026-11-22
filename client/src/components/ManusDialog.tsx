import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManusDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function ManusDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: ManusDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="py-5 apple-glass bg-[#f8f8f7] dark:bg-[#1c1c1e] rounded-[22px] w-[400px] shadow-[0px_4px_11px_0px_rgba(0,0,0,0.08)] border border-black/[0.08] dark:border-white/[0.10] backdrop-blur-2xl p-0 gap-0 text-center">
        <div className="flex flex-col items-center gap-2 p-5 pt-12">
          {logo ? (
            <div className="w-16 h-16 bg-white dark:bg-[#2c2c2e] rounded-2xl border border-black/[0.08] dark:border-white/[0.10] flex items-center justify-center">
              <img
                src={logo}
                alt="Siglă aplicație"
                className="w-10 h-10 rounded-md"
              />
            </div>
          ) : null}

          {/* Title and subtitle */}
          {title ? (
            <DialogTitle className="text-xl font-semibold text-[#1d1d1f] dark:text-white leading-[26px] tracking-[-0.44px]">
              {title}
            </DialogTitle>
          ) : null}
          <DialogDescription className="text-sm text-[#636366] dark:text-[#98989d] leading-5 tracking-[-0.154px]">
            Autentificați-vă pentru a continua
          </DialogDescription>
        </div>

        <DialogFooter className="px-5 py-5">
          {/* Login button */}
          <Button
            onClick={onLogin}
            className="w-full h-10 bg-[#1a1a19] dark:bg-white hover:bg-[#1a1a19]/90 dark:hover:bg-white/90 text-white dark:text-[#1d1d1f] rounded-full text-sm font-semibold leading-5 tracking-[-0.154px]"
          >
            Autentificare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
