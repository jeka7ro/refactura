import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import AllInvoices from "./pages/AllInvoices";
import InvoicesEmitted from "./pages/InvoicesEmitted";
import InvoiceDetail from "./pages/InvoiceDetail";
import ReInvoice from "./pages/ReInvoice";
import ReInvoicesSent from "./pages/ReInvoicesSent";
import ReInvoiceDetail from "./pages/ReInvoiceDetail";
import Clients from "./pages/Clients";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import CostCenters from "./pages/CostCenters";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import Landing from "./pages/Landing";
import SuperAdmin from "./pages/SuperAdmin";
import InvoiceArchive from "./pages/InvoiceArchive";
import ClientDetails from "./pages/ClientDetails";
import InvoicesReceived from "@/pages/InvoicesReceived";
import EmittedInvoices from "@/pages/EmittedInvoices";
import EmitInvoice from "./pages/EmitInvoice";
import PrintInvoice from "@/pages/PrintInvoice";
import EmittedInvoiceDetail from "@/pages/EmittedInvoiceDetail";
import NIRList from "@/pages/NIRList";
import NIRCreate from "@/pages/NIRCreate";
import DevizeList from "@/pages/DevizeList";
import DevizDetail from "@/pages/DevizDetail";
import BonuriConsumList from "@/pages/BonuriConsumList";
import BonConsumDetail from "@/pages/BonConsumDetail";
import Catalog from "@/pages/Catalog";
import HorecaDashboard from "@/pages/horeca/HorecaDashboard";
import HorecaLocations from "@/pages/horeca/HorecaLocations";
import HorecaMenu from "@/pages/horeca/HorecaMenu";
import HorecaInventory from "@/pages/horeca/HorecaInventory";
import HorecaOrders from "@/pages/horeca/HorecaOrders";
import HorecaDelivery from "@/pages/horeca/HorecaDelivery";
import HorecaTables from "@/pages/horeca/HorecaTables";
import HorecaOrderCreate from "@/pages/horeca/HorecaOrderCreate";
import HorecaKitchenDisplay from "@/pages/horeca/HorecaKitchenDisplay";
import HorecaShift from "@/pages/horeca/HorecaShift";
import HorecaKioskSettings from "@/pages/horeca/HorecaKioskSettings";
import HorecaTestPanel from "@/pages/horeca/HorecaTestPanel";
import KioskApp from "@/pages/kiosk/App.jsx";

function Router() {
  return (
    <Switch>
      {/* Public pages - no layout */}
      <Route path="/" component={Landing} />
      <Route path="/landing" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/super-admin" component={SuperAdmin} />

      {/* Dashboard pages - with layout */}
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/facturi">
        <DashboardLayout>
          <AllInvoices />
        </DashboardLayout>
      </Route>
      {/* /facturi-primite redirects to unified page but keep detail route */}
      <Route path="/facturi-primite">
        <DashboardLayout>
          <AllInvoices />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-primite/:id">
        <DashboardLayout>
          <InvoiceDetail />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise">
        <DashboardLayout>
          <InvoicesEmitted />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise-nou">
        <DashboardLayout>
          <EmittedInvoices />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise-nou/new">
        <DashboardLayout>
          <EmitInvoice />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise-nou/print/:id">
        <PrintInvoice />
      </Route>
      <Route path="/facturi-emise-nou/view/:id">
        <DashboardLayout>
          <EmittedInvoiceDetail />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise-nou/:id">
        <DashboardLayout>
          <EmitInvoice />
        </DashboardLayout>
      </Route>
      <Route path="/facturi-emise-nou/storno/:stornoId">
        <DashboardLayout>
          <EmitInvoice />
        </DashboardLayout>
      </Route>
      <Route path="/re-facturare/:id">
        <DashboardLayout>
          <ReInvoice />
        </DashboardLayout>
      </Route>
      <Route path="/re-facturi">
        <DashboardLayout>
          <ReInvoicesSent />
        </DashboardLayout>
      </Route>
      <Route path="/re-facturi/:id">
        <DashboardLayout>
          <ReInvoiceDetail />
        </DashboardLayout>
      </Route>
      {/* NIR Routes */}
      <Route path="/nir">
        <DashboardLayout>
          <NIRList />
        </DashboardLayout>
      </Route>
      <Route path="/nir/nou/:invoiceId">
        <DashboardLayout>
          <NIRCreate />
        </DashboardLayout>
      </Route>
      <Route path="/nir/nou">
        <DashboardLayout>
          <NIRCreate />
        </DashboardLayout>
      </Route>
      <Route path="/nir/:id">
        <DashboardLayout>
          <NIRCreate />
        </DashboardLayout>
      </Route>
      <Route path="/devize">
        <DashboardLayout>
          <DevizeList />
        </DashboardLayout>
      </Route>
      <Route path="/devize/catalog">
        <DashboardLayout>
          <Catalog />
        </DashboardLayout>
      </Route>
      <Route path="/devize/:id">
        <DashboardLayout>
          <DevizDetail />
        </DashboardLayout>
      </Route>
      <Route path="/bonuri-consum/:id">
        <DashboardLayout>
          <BonConsumDetail />
        </DashboardLayout>
      </Route>
      <Route path="/bonuri-consum">
        <DashboardLayout>
          <BonuriConsumList />
        </DashboardLayout>
      </Route>
      <Route path="/rapoarte">
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path="/clienti">
        <DashboardLayout>
          <Clients />
        </DashboardLayout>
      </Route>
      <Route path="/client/:id">
        <DashboardLayout>
          <ClientDetails />
        </DashboardLayout>
      </Route>
      <Route path="/integrari">
        <DashboardLayout>
          <Integrations />
        </DashboardLayout>
      </Route>
      <Route path="/setari">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      <Route path="/centre-cost">
        <DashboardLayout>
          <CostCenters />
        </DashboardLayout>
      </Route>
      <Route path="/arhiva-facturi">
        <DashboardLayout>
          <InvoiceArchive />
        </DashboardLayout>
      </Route>
      <Route path="/re-factura">
        <DashboardLayout>
          <ReInvoice />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      {/* ── HORECA MODULE ROUTES ──────────────────────────────── */}
      <Route path="/horeca">
        <DashboardLayout>
          <HorecaDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/locatii">
        <DashboardLayout>
          <HorecaLocations />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/meniu">
        <DashboardLayout>
          <HorecaMenu />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/gestiune">
        <DashboardLayout>
          <HorecaInventory />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/comenzi">
        <DashboardLayout>
          <HorecaOrders />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/kiosk">
        <DashboardLayout>
          <HorecaKioskSettings />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/test">
        <DashboardLayout>
          <HorecaTestPanel />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/delivery">
        <DashboardLayout>
          <HorecaDelivery />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/mese">
        <DashboardLayout>
          <HorecaTables />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/comenzi/nou">
        <DashboardLayout>
          <HorecaOrderCreate />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/tura">
        <DashboardLayout>
          <HorecaShift />
        </DashboardLayout>
      </Route>
      <Route path="/horeca/kds">
        <DashboardLayout>
          <HorecaKitchenDisplay />
        </DashboardLayout>
      </Route>
      {/* ── KIOSK MODULE ──────────────────────────────────────── */}
      <Route path="/kiosk/:locationId?">
        <KioskApp />
      </Route>
      {/* ────────────────────────────────────────────────────── */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
