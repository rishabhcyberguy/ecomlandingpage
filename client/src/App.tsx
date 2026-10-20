import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AdminGuard } from "./components/AdminLayout";
import { ThemeProvider } from "./contexts/ThemeContext";

const NotFound = lazy(() => import("@/pages/NotFound"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboard"));
const AdminLoginPage = lazy(() => import("@/pages/AdminLogin").then((module) => ({ default: module.AdminLoginPage })));
const CollectionPage = lazy(() => import("@/pages/Collection").then((module) => ({ default: module.CollectionPage })));
const CategoryPage = lazy(() => import("@/pages/Collection").then((module) => ({ default: module.CategoryPage })));
const ContactPage = lazy(() => import("@/pages/Contact"));
const Home = lazy(() => import("@/pages/Home"));
const PageEditorPage = lazy(() => import("@/pages/PageEditor"));
const PasswordResetRequestPage = lazy(() => import("@/pages/PasswordReset").then((module) => ({ default: module.PasswordResetRequestPage })));
const PasswordResetFormPage = lazy(() => import("@/pages/PasswordReset").then((module) => ({ default: module.PasswordResetFormPage })));
const ProductPage = lazy(() => import("@/pages/Product"));
const ProductEditorPage = lazy(() => import("@/pages/ProductEditor"));
const ProductPreviewPage = lazy(() => import("@/pages/ProductEditor").then((module) => ({ default: module.ProductPreviewPage })));

function ProtectedDashboard() { return <AdminGuard><AdminDashboardPage /></AdminGuard>; }
function ProtectedProductEditor() { return <AdminGuard><ProductEditorPage /></AdminGuard>; }
function ProtectedProductPreview() { return <AdminGuard><ProductPreviewPage /></AdminGuard>; }
function ProtectedPageEditor() { return <AdminGuard><PageEditorPage /></AdminGuard>; }

function Router() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading POLINA…</div>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/collections" component={CollectionPage} />
        <Route path="/category/:slug" component={CategoryPage} />
        <Route path="/products/:slug" component={ProductPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin/reset" component={PasswordResetRequestPage} />
        <Route path="/admin/reset-password" component={PasswordResetFormPage} />
        <Route path="/admin/products/:id/preview" component={ProtectedProductPreview} />
        <Route path="/admin/products/:id" component={ProtectedProductEditor} />
        <Route path="/admin/pages" component={ProtectedPageEditor} />
        <Route path="/admin" component={ProtectedDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
