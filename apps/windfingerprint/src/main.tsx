import { createRoot } from 'react-dom/client';

import App from '@/App';
import { AuthProvider } from '@/hooks/AuthContext';
import { StaticAuthService } from '@/services/StaticAuthService';

import './main.css';

// The GitHub Pages showcase build (VITE_SHOWCASE=true, see .env.pages) has no
// Rayfin/Fabric backend to talk to. Dynamically import bootstrapAuth so the
// Rayfin SDK and its backend calls are never even loaded there.
const authService =
  import.meta.env.VITE_SHOWCASE === 'true'
    ? new StaticAuthService()
    : await (await import('@/services/bootstrap')).bootstrapAuth();

createRoot(document.getElementById('root')!).render(
  <AuthProvider authService={authService}>
    <App />
  </AuthProvider>
);
