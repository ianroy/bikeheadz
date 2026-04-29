import './styles/index.css';
import { el } from './dom.js';
import { Router } from './router.js';
import { SocketClient } from './socket.js';
import { HeaderComponent } from './components/header.js';
import { HomePage } from './pages/home.js';
import { HowItWorksPage } from './pages/how-it-works.js';
import { AccountPage } from './pages/account.js';
import { PricingPage } from './pages/pricing.js';
import { CheckoutReturnPage } from './pages/checkout-return.js';

const root = document.getElementById('root');
Object.assign(root.style, {
  minHeight: '100vh',
  background: '#FAF7F2',
  color: '#1A1614',
  display: 'flex',
  flexDirection: 'column',
});

const socket = new SocketClient();

const header = HeaderComponent();
root.appendChild(header.el);

const main = el('main', { class: 'flex-1' });
root.appendChild(main);

const router = new Router({
  mount: main,
  onRoute: (path) => header.setActive(path),
  routes: {
    '/':                () => HomePage({ socket }),
    '/how-it-works':    () => HowItWorksPage({ socket }),
    '/account':         () => AccountPage({ socket }),
    '/pricing':         ({ query }) => PricingPage({ socket, cancelled: query.cancelled === '1' }),
    '/checkout/return': ({ query }) => CheckoutReturnPage({ socket, sessionId: query.session_id }),
  },
});
router.start();

// Exposed so page components can programmatically navigate without
// re-importing the router instance.
window.__router = router;
