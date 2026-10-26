export type AdminPage =
  | "dashboard"
  | "workers"
  | "services"
  | "orders"
  | "office"
  | "rooms"
  | "recovery"
  | "branding"
  | "settings"
  | "assets"
  | "activity"
  | "auth"
  | "mission-agents"
  | "mission-kanban"
  | "mission-meeting"
  | "mission-spawn"
  | "mission-connection"
  | "guest-chat";

export const ADMIN_PAGES: Array<{ id: AdminPage; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "workers", label: "Workers" },
  { id: "services", label: "Services" },
  { id: "orders", label: "Orders" },
  { id: "office", label: "Office" },
  { id: "rooms", label: "Rooms" },
  { id: "recovery", label: "Recovery" },
  { id: "branding", label: "Branding" },
  { id: "settings", label: "Pengaturan" },
  { id: "assets", label: "Assets" },
  { id: "activity", label: "Activity" },
  { id: "auth", label: "Auth" },
  { id: "mission-agents", label: "Agen" },
  { id: "mission-kanban", label: "Kanban" },
  { id: "mission-meeting", label: "Meeting" },
  { id: "mission-spawn", label: "Spawn" },
  { id: "mission-connection", label: "Koneksi" },
  { id: "guest-chat", label: "Pesan Tamu" },
];
