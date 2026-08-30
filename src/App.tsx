import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

/**
 * Toasts, told which theme they are in.
 *
 * Sonner paints its own surface rather than inheriting one, so it does not see
 * the `dark` class on the root and defaults to a white toast — legible on a
 * light page, a white slab on a dark one.
 *
 * It has to be a separate component: `theme` comes from a context that App
 * itself renders, so App is outside the provider and cannot read it.
 *
 * Passing the RESOLVED theme rather than sonner's own "system" setting, because
 * system is only correct when the user has not chosen. Someone who has forced
 * light on a dark phone would otherwise get dark toasts on a light app.
 */
const ThemedToaster = () => {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" style={{ bottom: '5rem' }} />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <ThemedToaster />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
