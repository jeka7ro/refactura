import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--warning-bg": "#fff7ed",
          "--warning-text": "#92400e",
          "--warning-border": "#fed7aa",
          "--error-bg": "#fef2f2",
          "--error-text": "#991b1b",
          "--error-border": "#fecaca",
          "--success-bg": "#f0fdf4",
          "--success-text": "#166534",
          "--success-border": "#bbf7d0",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          borderRadius: "10px",
          fontSize: "13px",
          fontFamily: "inherit",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
