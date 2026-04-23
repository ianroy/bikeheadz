import './styles/index.css';
import { el } from './dom.js';
import { Router } from './router.js';
import { SocketClient } from './socket.js';
import { HeaderComponent } from './components/header.js';
import { HomePage } from './pages/home.js';
import { HowItWorksPage } from './pages/how-it-works.js';
import { AccountPage } from './pages/account.js';

const root = document.getElementById('root');
Object.assign(root.style, {
  minHeight: '100vh',
  background: '#09090f',
  color: '#e0e0f0',
  display: 'flex',
  flexDirection: 'column',
});

const socket = new SocketClient();

const header = HeaderComponent({
  onNavigate: (path) => router.navigate(path),
});
root.appendChild(header.el);

const main = el('main', { class: 'flex-1' });
root.appendChild(main);

const router = new Router({
  mount: main,
  onRoute: (path) => header.setActive(path),
  routes: {
    '/':              () => HomePage({ socket }),
    '/how-it-works':  () => HowItWorksPage({ socket }),
    '/account':       () => AccountPage({ socket }),
  },
});
router.start();
