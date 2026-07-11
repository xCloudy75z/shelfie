import TabBar from "@/app/components/TabBar";
import ThemeToggle from "@/app/components/ThemeToggle";

// The authed shell: a mobile-friendly centered column with a fixed bottom tab
// bar and a persistent theme toggle. All three tabs live in the (app) route
// group so they share this chrome; /lock stays outside it (own full-screen UI).
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <ThemeToggle />
      <main className="app-body">{children}</main>
      <TabBar />
    </div>
  );
}
