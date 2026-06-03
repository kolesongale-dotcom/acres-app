import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { authEnabled } from "@/lib/auth";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar showSignOut={authEnabled()} />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "36px 44px 80px",
            maxWidth: 1400,
          }}
          className="animate-fade-in"
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
