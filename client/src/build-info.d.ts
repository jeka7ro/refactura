declare const __BUILD_NUMBER__: string;
declare const __BUILD_DATE__: string;

declare module "@/pages/kiosk/App.jsx" {
  const KioskApp: (props?: Record<string, unknown>) => any;
  export default KioskApp;
}
