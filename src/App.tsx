import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="bottom-center" style={{ bottom: '5rem' }} />
      </AuthProvider>
    </Router>
  );
}

export default App;