// P6-002 — English locale dictionary.
//
// Flat string-keyed dict. Keep keys stable; add new ones rather than
// reshaping. Spanish (es.js) mirrors this set.

export default {
  // Navigation
  'nav.home': 'Home',
  'nav.account': 'Account',
  'nav.pricing': 'Pricing',
  'nav.howItWorks': 'How It Works',
  'nav.help': 'Help',

  // Calls to action
  'cta.upload': 'Upload photo',
  'cta.generate': 'Generate',
  'cta.buy.stl': 'Buy STL',
  'cta.checkout': 'Checkout',

  // Viewer
  'viewer.loading': 'Loading…',
  'viewer.ready': 'STL Ready',

  // Errors
  'error.no_face': 'We couldn’t find a face in this photo. Try another.',
  'error.rate_limited': 'Too many requests — give it a minute and try again.',
  'error.payment_required': 'Payment required to continue.',

  // Auth
  'auth.send_link': 'Send sign-in link',
  'auth.check_email': 'Check your email for the sign-in link.',

  // Pricing
  'pricing.stl.title': 'STL download',
  'pricing.stl.desc': 'Print it yourself on any FDM printer.',

  // Home
  'home.hero.headline': 'Your face, on your bike.',
  'home.hero.sub': 'Custom-printed valve caps from a single photo.',

  // Account
  'account.tab.designs': 'Designs',
  'account.tab.orders': 'Orders',
  'account.tab.settings': 'Settings',

  // Feedback
  'feedback.thanks': 'Thanks for the feedback!',
  'feedback.thumbs_up': 'Looks great',
  'feedback.thumbs_down': 'Needs work',
  'feedback.shrug': 'Meh',

  // Share
  'share.copied': 'Link copied',
  'share.button': 'Share',

  // Install banner
  'install.banner.text': 'Install StemDomeZ on your phone for offline access.',
  'install.banner.yes': 'Install',
  'install.banner.no': 'Not now',
};
