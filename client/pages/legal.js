// X-004 / X-008 — Static legal + security pages.
//
// Each page renders identical chrome (workshop palette card, header,
// last-updated date). The actual copy is placeholder — a lawyer needs to
// review before launch (see docs/LAUNCH_CHECKLIST.md). The shape is the
// production layout.

import { el } from '../dom.js';

const VERSION = '2026-04-29';

function legalShell({ title, intro, sections }) {
  const wrap = el(
    'main.legal-page',
    {
      style: {
        maxWidth: '760px',
        margin: '48px auto',
        padding: '0 24px',
        color: 'var(--ink, #0E0A12)',
      },
    },
    el('h1', { style: { fontSize: '32px', marginBottom: '8px', color: '#7B2EFF' } }, title),
    el(
      'p',
      { style: { color: '#3D2F4A', fontSize: '14px', marginBottom: '32px' } },
      `Last updated ${VERSION}`
    ),
    intro ? el('p', { style: { lineHeight: 1.6 } }, intro) : null,
    ...sections.map((s) =>
      el(
        'section',
        { style: { marginTop: '32px' } },
        el('h2', { style: { fontSize: '20px', marginBottom: '8px' } }, s.heading),
        ...(Array.isArray(s.body) ? s.body : [s.body]).map((p) =>
          el('p', { style: { lineHeight: 1.6, marginBottom: '12px' } }, p)
        )
      )
    )
  );
  return wrap;
}

export function TermsPage() {
  return legalShell({
    title: 'Terms of Service',
    intro:
      'These terms govern your use of ValveHeadZ (the "Service"). By accessing or using the Service, you agree to be bound by these terms.',
    sections: [
      {
        heading: '1. Eligibility',
        body: 'You must be at least 13 years old to use ValveHeadZ. By using the Service you represent that you meet this requirement.',
      },
      {
        heading: '2. Acceptable use',
        body: [
          'You may not upload images you do not have the right to use, including photographs of other people without their consent.',
          'You may not use the Service to create, distribute, or enable misleading impersonations of any person, including public figures.',
          'See the Acceptable Use Policy for the full list of prohibited uses.',
        ],
      },
      {
        heading: '3. Content & ownership',
        body: 'You retain ownership of the photos you upload. You grant ValveHeadZ a limited, non-exclusive license to process those photos for the sole purpose of delivering the Service. STL files generated for you are yours to keep, modify, print, and share.',
      },
      {
        heading: '4. Payment & refunds',
        body: 'Purchases are processed by Stripe. Refunds are available within 14 days of purchase, less any costs already incurred for printing or shipping. Contact support@valveheadz.app to request a refund.',
      },
      {
        heading: '5. Disclaimer & limitation of liability',
        body: 'The Service is provided "as is" without warranty of any kind. To the maximum extent permitted by law, ValveHeadZ shall not be liable for any indirect, incidental, special, or consequential damages.',
      },
      {
        heading: '6. Changes to these terms',
        body: 'We may update these terms from time to time. The "Last updated" date at the top reflects the most recent revision. Material changes will be announced via email to active users.',
      },
      {
        heading: '7. Contact',
        body: 'Questions: legal@valveheadz.app',
      },
    ],
  });
}

export function PrivacyPage() {
  return legalShell({
    title: 'Privacy Policy',
    intro:
      'ValveHeadZ is committed to protecting your privacy. This policy explains what data we collect, why we collect it, and how long we keep it.',
    sections: [
      {
        heading: '1. What we collect',
        body: [
          'Photos you upload to generate a 3D head. Photos are stored in your photo library for 90 days and used only to (re-)generate STL files for you. (See P1-006 in our roadmap.)',
          'Email address — required for sign-in and order receipts.',
          'Stripe purchase records — retained for 7 years to comply with payment processor and tax requirements. Email addresses on these records are anonymized when you delete your account.',
          'Audit log entries — actions taken by you or by support staff on your behalf. We do not log photo bytes or STL contents, only ids and small JSON metadata.',
        ],
      },
      {
        heading: '2. What we DON’T collect',
        body: [
          'We do not run face recognition against any external database.',
          'We do not sell your data to third parties.',
          'We do not use your photos to train AI models. Photos and STLs are deleted on the schedule described above.',
        ],
      },
      {
        heading: '3. Retention',
        body: [
          'Photos: 90 days from last use.',
          'STLs: 24 hours for unpurchased designs; indefinite for purchased designs (you can delete them from /account at any time).',
          'Failure-corpus snapshots (when generation fails): 30 days, used to debug pipeline regressions; auto-rotated.',
          'Account profile: until you delete your account.',
        ],
      },
      {
        heading: '4. Your rights',
        body: 'You can export all data we hold about you (Settings → Export my data) or request deletion (Settings → Delete my account). Both flows are self-serve and immediate; Stripe records persist as required by law but the email is anonymized.',
      },
      {
        heading: '5. Security',
        body: 'We use TLS for all traffic, hash-store passwords (we use passwordless magic-link authentication), and run secure cookies (HttpOnly, SameSite=Lax, Secure in production). Vulnerability reports: security@valveheadz.app — see /security.',
      },
      {
        heading: '6. Contact',
        body: 'Questions: privacy@valveheadz.app',
      },
    ],
  });
}

export function AcceptableUsePage() {
  return legalShell({
    title: 'Acceptable Use Policy',
    intro:
      'ValveHeadZ is for fans of bikes and 3D printing. Please use it accordingly. The list below is illustrative, not exhaustive.',
    sections: [
      {
        heading: 'You may not',
        body: [
          'Upload photos of people who have not consented to their likeness being processed.',
          'Use the Service to create likenesses of public figures, celebrities, or government officials in a manner intended to deceive viewers.',
          'Attempt to extract NSFW content, weapon-shaped objects, or content depicting minors in unsafe ways. Our pre-screen will reject these uploads (see P3-012).',
          'Bypass rate limits, automate scraping, or attempt to overwhelm the GPU backend.',
          'Re-sell ValveHeadZ-generated STLs as your own original work without modification.',
        ],
      },
      {
        heading: 'Reporting abuse',
        body: 'See a design or user violating this policy? Tap the flag button on the design, or email abuse@valveheadz.app. We review reports within 48h.',
      },
      {
        heading: 'Enforcement',
        body: 'We can — and will — suspend accounts and refuse refunds for violations. Severe or repeated violations may result in permanent bans and referral to law enforcement when appropriate.',
      },
    ],
  });
}

export function SecurityPage() {
  return legalShell({
    title: 'Security disclosure policy',
    intro:
      'Found a security issue? Thank you. We take reports seriously and want to make it easy to do the right thing.',
    sections: [
      {
        heading: 'Reporting',
        body: [
          'Email: security@valveheadz.app (PGP key available on request)',
          'We aim to respond within 2 business days.',
        ],
      },
      {
        heading: 'Disclosure window',
        body: 'We coordinate disclosure on a 90-day window from the date of your report. Critical issues with a clear remediation can be disclosed sooner once the fix is in production.',
      },
      {
        heading: 'Hall of fame',
        body: 'With your permission we’ll list you on this page after a fix lands. Add your name + handle in the report if you’d like to be credited.',
      },
      {
        heading: 'Out of scope',
        body: [
          'Findings against staging or test infrastructure that do not affect production users.',
          'Reports requiring physical access to a user’s device.',
          'Self-XSS, denial-of-service via brute force, missing security headers on third-party domains we don’t control.',
        ],
      },
    ],
  });
}

export function NotFoundPage() {
  return legalShell({
    title: '404 — that head isn’t in the workshop',
    intro:
      'The page you’re looking for doesn’t exist (or expired). Try one of the links below — or head back to the workshop.',
    sections: [
      {
        heading: 'Where to go',
        body: [
          'Home — start a new design.',
          'Pricing — what we charge.',
          'How it works — three-minute tour.',
          'Help — answers to common questions.',
        ],
      },
    ],
  });
}

export function ServerErrorPage({ incidentId }) {
  return legalShell({
    title: '500 — something cracked the cap',
    intro:
      'Something went wrong on our side. We logged it and our on-call should already know.',
    sections: [
      {
        heading: 'What you can do',
        body: [
          'Refresh — most blips are momentary.',
          'If you were mid-purchase, your card was not charged unless Stripe explicitly confirmed it.',
          incidentId
            ? `Send us this incident id when reporting: ${incidentId}`
            : 'If it keeps happening, drop us a line at help@valveheadz.app.',
        ],
      },
    ],
  });
}
