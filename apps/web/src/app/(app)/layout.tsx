import { Sidebar } from '@/components/layout/Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* h-screen + overflow-hidden here is critical — it lets full-workspace
          pages (editor, rooms) be exactly viewport-height with independent
          panel scrolling. Non-workspace pages overflow naturally because
          they don't set h-screen themselves. */}
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        {/* overflow-y-auto here so normal pages (dashboard, leaderboard) still scroll */}
        <main className="flex-1 ml-60 h-full overflow-y-auto">
          {children}
        </main>
      </div>
      <ToastContainer />
    </ThemeProvider>
  );
}
