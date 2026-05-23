import { Sidebar } from '@/components/layout/Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-60 min-h-screen">
          {children}
        </main>
      </div>
      <ToastContainer />
    </ThemeProvider>
  );
}
