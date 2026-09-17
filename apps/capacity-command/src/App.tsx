import { GamePage } from '@/pages/GamePage';

/**
 * The app is a single screen: there is no sign-in to route around and no
 * second page, so it ships without a router. That also means the host web
 * server needs no SPA fallback rule: it is one static page plus assets.
 */
function App() {
  return <GamePage />;
}

export default App;
