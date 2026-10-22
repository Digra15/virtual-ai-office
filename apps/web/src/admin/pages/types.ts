export type AdminPage =
  | "dashboard"
  | "workers"
  | "services"
  | "orders"
  | "office"
  | "branding"
  | "assets"
  | "activity"
  | "auth";

export const ADMIN_PAGES: Array<{ id: AdminPage; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "workers", label: "Workers" },
  { id: "services", label: "Services" },
  { id: "orders", label: "Orders" },
  { id: "office", label: "Office" },
  { id: "branding", label: "Branding" },
  { id: "assets", label: "Assets" },
  { id: "activity", label: "Activity" },
  { id: "auth", label: "Auth" },
];
