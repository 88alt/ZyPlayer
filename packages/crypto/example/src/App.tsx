import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/i18n';
import { MainApp } from './pages';

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <I18nProvider>
        <TooltipProvider>
          <Toaster position="top-center" offset={{ top: 44 }} mobileOffset={{ top: 44 }} />
          <MainApp />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
