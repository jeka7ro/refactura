import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 apple-canvas bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8 apple-glass rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] shadow-lg">
            <AlertTriangle
              size={48}
              className="text-destructive mb-5 flex-shrink-0"
            />

            <h2 className="text-xl font-bold text-[#1d1d1f] dark:text-white mb-2 text-center">
              A apărut o eroare neașteptată
            </h2>
            <p className="text-sm text-[#636366] dark:text-[#98989d] mb-5 text-center">
              {this.state.error?.message || "Aplicația a întâmpinat o problemă temporară la afișare."}
            </p>

            {import.meta.env.DEV && this.state.error?.stack && (
              <details className="w-full mb-6 rounded-2xl bg-muted/70 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
                <summary className="px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                  Detalii tehnice
                </summary>
                <div className="p-4 pt-1 overflow-auto max-h-64">
                  <pre className="text-xs font-sans text-muted-foreground whitespace-break-spaces">
                    {this.state.error.stack}
                  </pre>
                </div>
              </details>
            )}

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm",
                "bg-primary text-primary-foreground shadow-sm",
                "hover:opacity-90 transition-opacity cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reîncarcă pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
