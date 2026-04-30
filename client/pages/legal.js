// Static legal + security pages.
//
// Every page renders identical chrome (pinned-light shell, italic
// display heading with fluoro drop shadow, ink-on-cream body type at
// 17.48:1) so contrast is consistent across light + dark + AAA modes.
// The copy below was drafted by the StemDomeZ owner; it is *not* a
// substitute for legal review before launch. Operator should pass
// these through a lawyer + iterate.

import { el } from '../dom.js';

export const LEGAL_VERSION = '2026-04-30';

function legalShell({ title, intro, sections }) {
  // Pinned-light shell mirroring the admin page's design cue:
  // paper background, beige cards (paper-soft), ink type, italic
  // display heading with fluoro drop shadow.
  const wrap = el(
    'main.legal-page',
    {
      style: {
        maxWidth: '780px',
        margin: '48px auto',
        padding: '24px',
        background: '#F5F2E5',
        color: '#0E0A12',
        borderRadius: '14px',
        border: '2px solid #D7CFB6',
      },
    },
    el('h1', {
      class: 'sdz-display',
      style: {
        fontSize: '34px',
        marginBottom: '6px',
        color: '#0E0A12',
        textShadow: '4px 4px 0 #2EFF8C',
      },
    }, title),
    el('p', {
      style: {
        color: '#1F1A2E',
        fontSize: '13px',
        fontStyle: 'italic',
        fontWeight: 600,
        marginBottom: '24px',
      },
    }, `Last updated ${LEGAL_VERSION}`),
    intro
      ? el('p', {
          style: {
            lineHeight: 1.65, fontSize: '1rem', color: '#0E0A12',
            background: '#E5E0CC', border: '2px solid #0E0A12',
            borderRadius: '12px', padding: '16px 18px', marginBottom: '24px',
          },
        }, intro)
      : null,
    ...sections.map((s) =>
      el('section',
        {
          style: {
            background: '#E5E0CC',
            border: '2px solid #0E0A12',
            borderRadius: '12px',
            padding: '18px 20px',
            marginTop: '14px',
          },
        },
        el('h2', {
          style: {
            fontSize: '0.95rem',
            fontWeight: 800,
            fontStyle: 'italic',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
            color: '#0E0A12',
            borderBottom: '2px solid #2EFF8C',
            paddingBottom: '6px',
            display: 'inline-block',
          },
        }, s.heading),
        ...(Array.isArray(s.body) ? s.body : [s.body]).map((p) =>
          typeof p === 'string'
            ? el('p', { style: { lineHeight: 1.65, marginBottom: '10px', color: '#0E0A12', fontSize: '0.95rem' } }, p)
            : p
        )
      )
    )
  );
  return wrap;
}

// ── Terms of Service ──────────────────────────────────────────────
export function TermsPage() {
  return legalShell({
    title: 'Terms of Service.',
    intro:
      'These Terms of Service ("Terms") govern your access to and use of StemDomeZ — a service that turns a photograph of a face into a 3D-printable Schrader valve cap (the "Service"), operated by StemDomeZ ("we", "us"). By creating an account, uploading any content, or otherwise using the Service, you ("you", "User") agree to these Terms. If you do not agree, do not use the Service.',
    sections: [
      {
        heading: '1. Eligibility',
        body: [
          'You must be at least 18 years old to create an account or upload any photo. The Service is not directed to children. We do not knowingly collect personal information from minors. If we learn that an account belongs to a minor, the account and its uploads will be deleted.',
          'By using the Service you represent that you have the legal capacity to enter into these Terms in your jurisdiction.',
        ],
      },
      {
        heading: '2. Photos you upload — license & warranty',
        body: [
          'You may upload only photographs of (a) yourself, or (b) another adult who has given you express, informed, and revocable consent to have their likeness uploaded, processed by an AI 3D-reconstruction model, and rendered as a 3D-printable physical object.',
          'You expressly warrant that, for every photo you upload, you have the legal right to do so and that the upload does not infringe any third-party right (including privacy, publicity, copyright, or trademark).',
          'You retain ownership of your photos. You grant StemDomeZ a limited, non-exclusive, non-transferable, royalty-free license to (i) process the photo through our pipeline (TRELLIS + CAD steps) for the purpose of generating a 3D mesh and STL file for you, and (ii) display the photo back to you in your account. We do not use your photos to train models, do not sell them, and do not share them with anyone other than the third-party processors listed in the Privacy Policy and only as required to deliver the Service.',
          'STL files generated for you remain yours. You may print, modify, share, or commercially use them subject to applicable law.',
        ],
      },
      {
        heading: '3. What you may not upload',
        body: [
          'Photos depicting any person under the age of 18, in any context.',
          'Photos depicting nudity, sexual content, or sexualised content of any kind.',
          'Photos of public figures, celebrities, government officials, or other identifiable third parties without their documented written consent.',
          'Photos used to create a likeness intended to defraud, harass, defame, threaten, dox, or impersonate any person.',
          'Photos that violate any applicable law, regulation, or third-party right.',
          'Photos depicting violence, gore, or illegal acts.',
          'See the Acceptable Use Policy for the full enumeration. We may refuse to process any upload at our sole discretion. We may also remove or refuse to deliver any STL we determine, in good faith, violates these Terms.',
        ],
      },
      {
        heading: '4. NO PRINT-QUALITY GUARANTEE',
        body: [
          'You acknowledge that 3D-print outcomes depend on many factors outside our control, including but not limited to: your printer, slicer, filament, ambient temperature, humidity, calibration, file orientation, support placement, and the quality of the input photograph. The TRELLIS model and CAD pipeline that produce the STL are heuristic and probabilistic; outputs vary, may include thin walls, non-watertight regions, internal voids, or other defects, and may fail to print on any given setup.',
          'WE MAKE NO WARRANTY THAT ANY STL WILL PRINT SUCCESSFULLY, FIT A SCHRADER VALVE, BE STRUCTURALLY SOUND, RESEMBLE THE PERSON IN THE INPUT PHOTO, OR BE FREE OF DEFECTS. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."',
          'You are solely responsible for inspecting any STL before printing and for any consequences of printing it, including damage to your printer, materials, or property.',
        ],
      },
      {
        heading: '5. Printing safety — assumed by you',
        body: [
          '3D printing involves heat, moving parts, and the emission of fumes and ultrafine particles. You assume all risk associated with printing any STL produced by the Service. We do not supervise, recommend, or warrant any specific printer, filament, or print profile.',
          'Printed Schrader valve caps generated by the Service are decorative novelty objects. They are not certified for safety-critical use. Inspect every printed cap before installing it on a wheel. We are not responsible for tire pressure loss, valve damage, accidents, or injuries arising from the use of any printed cap.',
          'Keep printed parts away from children under 3 — they are choking hazards.',
        ],
      },
      {
        heading: '6. Account responsibility',
        body: [
          'You are responsible for all activity under your account, including maintaining the security of your sign-in email and (if you opt in) password. We strongly recommend not sharing magic-link emails. Notify us at security@stemdomez.com immediately if you suspect unauthorised access.',
          'You may delete your account at any time from /account → Settings. Deletion permanently removes your photos, designs, and profile. Stripe-related transaction records are retained as required by law and tax authorities, but the email address attached to those records is anonymised.',
        ],
      },
      {
        heading: '7. Payments, refunds, free MVP launch',
        body: [
          'During the MVP launch window the Service is offered free of charge for STL downloads, gated only on a logged-in account. We may, at any time and at our sole discretion, re-enable paid downloads, third-party printing, and/or change pricing.',
          'When payments are enabled, purchases are processed by Stripe, Inc. We do not store card details. Refunds for unprinted STL downloads are available within 14 days of purchase; printed-and-shipped products are non-refundable except where required by law or where the product is materially defective on arrival.',
          'Promo codes, free trials, and invite credits are revocable at any time and have no cash value.',
        ],
      },
      {
        heading: '8. Indemnification',
        body: [
          'You agree to indemnify, defend, and hold harmless StemDomeZ, its operator, its contractors, and its service providers from any claim, loss, damage, liability, or expense (including reasonable attorneys’ fees) arising out of or related to (i) your uploads or any use you make of an STL we generated for you, (ii) your breach of these Terms or any law, or (iii) your infringement of any third-party right.',
        ],
      },
      {
        heading: '9. Disclaimer of warranties',
        body: [
          'TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE AND ALL CONTENT, STL FILES, AND OUTPUTS ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AND ANY WARRANTY ARISING FROM A COURSE OF DEALING OR USAGE OF TRADE.',
        ],
      },
      {
        heading: '10. Limitation of liability',
        body: [
          'TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL STEMDOMEZ BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR PRINT MATERIALS, ARISING OUT OF OR RELATED TO THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY.',
          'OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE SIX MONTHS PRECEDING THE CLAIM, OR (B) USD $50.',
          'Some jurisdictions do not allow the exclusion of certain warranties or the limitation of liability for incidental or consequential damages, so some of the above may not apply to you. Where the law of your jurisdiction is more protective, that law applies to the extent required.',
        ],
      },
      {
        heading: '11. Termination',
        body: [
          'We may suspend or terminate your account at any time, with or without notice, for any violation of these Terms, the Acceptable Use Policy, or for any other lawful reason. Upon termination your access to the Service ends and any pending downloads may be revoked. Sections 4, 5, 8, 9, 10, and 13 survive termination.',
        ],
      },
      {
        heading: '12. DMCA / copyright',
        body: [
          'We respect intellectual property rights. If you believe content on the Service infringes your copyright, file a notice under the DMCA Policy. Repeat infringers will be terminated.',
        ],
      },
      {
        heading: '13. Governing law, venue, dispute resolution',
        body: [
          'These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-laws principles. Any dispute, claim, or controversy arising out of or related to the Service or these Terms will be resolved by binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules. The arbitration will be held in English, in Wilmington, Delaware, or by remote hearing. You waive any right to participate in a class action or class-wide arbitration.',
          'Notwithstanding the foregoing, either party may bring a small-claims action in a court of competent jurisdiction.',
        ],
      },
      {
        heading: '14. Changes to these Terms',
        body: [
          'We may update these Terms from time to time. The "Last updated" date at the top reflects the latest revision. If a material change requires re-acceptance, we will surface a TOS-acceptance prompt the next time you sign in. Continued use after a material change constitutes acceptance.',
        ],
      },
      {
        heading: '15. Contact',
        body: [
          'Legal: legal@stemdomez.com',
          'General: help@stemdomez.com',
          'Abuse: abuse@stemdomez.com',
          'Security: security@stemdomez.com',
        ],
      },
    ],
  });
}

// ── Privacy Policy ────────────────────────────────────────────────
export function PrivacyPage() {
  return legalShell({
    title: 'Privacy Policy.',
    intro:
      'This Privacy Policy explains what personal data StemDomeZ collects, why we collect it, how long we keep it, and your rights to access, export, and delete it. It applies to anyone using the Service worldwide; additional rights for residents of California (CCPA/CPRA) and the European Economic Area / United Kingdom (GDPR/UK GDPR) are noted where relevant.',
    sections: [
      {
        heading: 'A. Data we collect',
        body: [
          'Photographs you upload: image bytes, filename, original size, SHA-256 hash, and an internal photo id. Stored in your photo library on a private server — never on a public bucket — and used only to generate STLs for you.',
          'Account details: email address, display name (optional), avatar choice (optional), language preference, role (default "user"), and timestamp of last login.',
          'Authentication: magic-link tokens (15-minute lifespan, single use) and, if you opt in, a salted scrypt password hash. We never store passwords in plaintext.',
          'Generated designs: the binary STL bytes, slider settings, generation timestamp, and pipeline telemetry (triangle count, retry flag).',
          'Purchase records (only when payments are enabled): Stripe session id, amount, currency, product, ZIP-truncated billing address (when shipping), and payment status.',
          'Usage logs: anonymised page views (path, referrer, IP truncated to /24, geo country + city via IP lookup, device kind, OS, browser), command audit entries, and email delivery events.',
          'Cookies: see the Cookies section below.',
        ],
      },
      {
        heading: 'B. Why we collect it (lawful bases)',
        body: [
          'To deliver the Service you requested (generation, download, account management) — performance of contract.',
          'To prevent abuse (rate limiting, brute-force detection, audit trail) — legitimate interest.',
          'To process payments you initiate — performance of contract; the payment flow itself is operated by Stripe under their privacy policy.',
          'To send the transactional emails you cannot opt out of (sign-in links, password resets, order receipts) — performance of contract / legitimate interest.',
          'To send marketing emails (only if you have opted in) — consent. You can withdraw consent in /account → Settings → Email preferences at any time.',
        ],
      },
      {
        heading: 'C. Who we share it with',
        body: [
          'Stripe, Inc. — payment processing (when payments are enabled). Stripe receives transaction data per their own privacy policy.',
          'RunPod, Inc. — GPU inference hosting. We send the photo bytes to a serverless RunPod endpoint for the duration of generation; no permanent retention occurs on RunPod beyond the run.',
          'DigitalOcean, LLC — application hosting + managed Postgres database. They process data on our behalf as a sub-processor.',
          'Resend, Inc. — transactional email delivery. They receive recipient email + message body.',
          'ImprovMX — inbound email forwarding for our staff inboxes (does not handle user data unless you email us).',
          'Sentry — error monitoring. Stack traces and error metadata only; no photo bytes or STL contents.',
          'We do not sell your personal data. We do not run advertising. We do not share data with data brokers.',
        ],
      },
      {
        heading: 'D. Retention',
        body: [
          'Photos: 90 days from last use, then automatically deleted from object storage.',
          'STLs: 24 hours for unpurchased designs; until you delete them otherwise.',
          'Failure-corpus snapshots (when generation fails): 30 days, used only to debug pipeline regressions.',
          'Magic-link / password-reset tokens: 15 minutes, single use.',
          'Sessions: 30 days from last use.',
          'Page-view logs: 90 days at full resolution; aggregated counts retained indefinitely.',
          'Audit log: 24 months.',
          'Account profile: until you delete your account.',
          'Stripe transaction records: 7 years to comply with payment-processor and tax requirements; the linked email is anonymised when you delete your account.',
        ],
      },
      {
        heading: 'E. Cookies',
        body: [
          'sd_session — HttpOnly, SameSite=Lax, Secure (in production); identifies your authenticated session.',
          'sd_visitor — HttpOnly; anonymous identifier used to attribute multiple page views from the same visitor for funnel analytics.',
          'sd_contrast — non-essential UI preference (AAA contrast toggle), only set when an admin has enabled the toggle and you flip it on.',
          'No third-party tracking cookies. We do not embed Google Analytics, Facebook Pixel, or similar. Stripe Checkout does set its own cookies on stripe.com when you visit the hosted checkout page.',
        ],
      },
      {
        heading: 'F. Your rights',
        body: [
          'Access — see everything we hold about you in /account.',
          'Export — download a JSON bundle of your data via /account → Settings → Export my data.',
          'Correction — edit display name, locale, avatar, and email preferences directly in /account.',
          'Deletion — delete your account in /account → Settings → Delete my account. Deletion is immediate and self-serve.',
          'Portability — the JSON export is portable; STLs export as binary STL.',
          'Restrict / object to processing — email privacy@stemdomez.com.',
          'Lodge a complaint with a supervisory authority (EEA/UK) — your local data-protection regulator; we will not retaliate.',
          'CCPA "do not sell or share" — we do not sell or share for cross-context behavioural advertising; opting out is automatic.',
        ],
      },
      {
        heading: 'G. Security',
        body: [
          'TLS for all network traffic. Encrypted at-rest databases on our hosting providers. Passwords (when used) are stored as salted scrypt hashes; we cannot recover them. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Sessions are server-side, revocable, and bumped on role changes.',
          'No security control is perfect. Report vulnerabilities responsibly to security@stemdomez.com — see /security.',
        ],
      },
      {
        heading: 'H. Children',
        body: [
          'The Service is not directed to children under 18. We do not knowingly collect personal information from anyone under 18. If you are a parent or guardian and believe your child has used the Service, contact privacy@stemdomez.com and we will delete the account and any uploaded content.',
        ],
      },
      {
        heading: 'I. International transfers',
        body: [
          'Data is hosted in the United States (DigitalOcean, AWS via Stripe and Resend). If you are in the EEA / UK, your data is transferred to the US under appropriate safeguards (Standard Contractual Clauses with sub-processors that hold them).',
        ],
      },
      {
        heading: 'J. Changes to this policy',
        body: [
          'We may update this Privacy Policy from time to time. Material changes will be announced via email to active users and surfaced as a re-acceptance prompt at next sign-in. The "Last updated" date at the top reflects the latest revision.',
        ],
      },
      {
        heading: 'K. Contact',
        body: [
          'Privacy: privacy@stemdomez.com',
          'EU/UK representative inquiries: privacy@stemdomez.com',
          'Postal: contact privacy@stemdomez.com to request the postal address used for legal correspondence.',
        ],
      },
    ],
  });
}

// ── Acceptable Use Policy ─────────────────────────────────────────
export function AcceptableUsePage() {
  return legalShell({
    title: 'Acceptable Use Policy.',
    intro:
      'This Acceptable Use Policy ("AUP") supplements the Terms of Service. It enumerates the things you must not do on the Service. The list is illustrative, not exhaustive — the Terms grant us discretion to refuse any upload or use we believe, in good faith, violates this policy or any law.',
    sections: [
      {
        heading: 'A. Hard prohibitions (zero tolerance)',
        body: [
          'No content depicting any person under 18 years of age, in any context.',
          'No nude, sexual, or sexualised content of any kind.',
          'No Child Sexual Abuse Material ("CSAM"). Any such upload will be reported to the National Center for Missing & Exploited Children (NCMEC) under 18 U.S.C. § 2258A and to law enforcement; the account will be permanently banned and all uploads preserved as required.',
          'No content used to dox, harass, threaten, defame, defraud, or stalk any person.',
          'No content depicting violence, gore, or illegal acts.',
        ],
      },
      {
        heading: 'B. Photos of other people',
        body: [
          'You may only upload a photo of another person if that person is an adult and has given you express, informed, and revocable consent to have their likeness uploaded, processed by an AI 3D-reconstruction model, and converted into a 3D-printable physical object that you may share or distribute.',
          'You may not upload photos of public figures, celebrities, government officials, or other identifiable third parties without their documented written consent.',
          'You may not use the Service to generate content intended to deceive viewers about the identity of the person depicted.',
        ],
      },
      {
        heading: 'C. Service abuse',
        body: [
          'No bypassing rate limits, scraping, automating account creation, or attempting to overwhelm the GPU backend.',
          'No reverse engineering, decompilation, or attempt to extract the model weights, the CAD pipeline, or other proprietary components.',
          'No re-selling of unmodified StemDomeZ-generated STLs as your own original work.',
          'No use of invite codes, promo codes, or invite credits to evade bans, refunds, or limits.',
          'No security testing without prior written authorisation. See /security for the responsible-disclosure policy.',
        ],
      },
      {
        heading: 'D. Third-party rights',
        body: [
          'No content that infringes any copyright, trademark, trade secret, patent, or other intellectual-property right.',
          'No content you do not have the right to upload, including under any contract or non-disclosure obligation.',
          'See the DMCA Policy for the takedown process.',
        ],
      },
      {
        heading: 'E. Reporting violations',
        body: [
          'See a design or user violating this policy? Email abuse@stemdomez.com with the design id, account email (if known), and a description of the issue. We review reports within 48 hours and act when warranted.',
        ],
      },
      {
        heading: 'F. Enforcement',
        body: [
          'We can — and will — suspend, restrict, or permanently terminate accounts for violations. Severe or repeated violations result in permanent bans and, where applicable, referral to law enforcement and to the relevant copyright owners. Refunds may be denied for terminated accounts in line with the Terms of Service.',
        ],
      },
    ],
  });
}

// ── DMCA Policy ───────────────────────────────────────────────────
export function DmcaPage() {
  return legalShell({
    title: 'DMCA Policy.',
    intro:
      'StemDomeZ respects intellectual-property rights and complies with the Digital Millennium Copyright Act ("DMCA", 17 U.S.C. § 512). If you believe content on the Service infringes your copyright, you may file a takedown notice with our designated agent below.',
    sections: [
      {
        heading: 'A. How to file a takedown notice',
        body: [
          'To be effective under the DMCA, your written notice must include each of the following (17 U.S.C. § 512(c)(3)):',
          '1. A physical or electronic signature of the person authorised to act on behalf of the copyright owner.',
          '2. Identification of the copyrighted work claimed to be infringed.',
          '3. Identification of the material claimed to be infringing and reasonably sufficient information to permit us to locate it (e.g. the share URL or design id).',
          '4. Information reasonably sufficient to permit us to contact you (mailing address, telephone number, email).',
          '5. A statement that you have a good-faith belief that use of the material in the manner complained of is not authorised by the copyright owner, its agent, or the law.',
          '6. A statement, under penalty of perjury, that the information in the notification is accurate and that you are authorised to act on behalf of the owner of an exclusive right that is allegedly infringed.',
        ],
      },
      {
        heading: 'B. Designated agent',
        body: [
          'Email: dmca@stemdomez.com',
          'Postal: contact dmca@stemdomez.com to obtain the current postal address for legal correspondence.',
          'We aim to respond to properly-formatted notices within 5 business days.',
        ],
      },
      {
        heading: 'C. Counter-notice',
        body: [
          'If you believe content of yours was removed in error, you may file a counter-notice with the same agent. Per 17 U.S.C. § 512(g)(3), your counter-notice must include:',
          '1. Your physical or electronic signature.',
          '2. Identification of the material that was removed and the location it appeared before removal.',
          '3. A statement, under penalty of perjury, that you have a good-faith belief the material was removed as a result of mistake or misidentification.',
          '4. Your name, address, telephone number, and a statement that you consent to the jurisdiction of the federal district court for the judicial district in which your address is located, and that you will accept service of process from the person who filed the original notice.',
          'Upon receipt of a valid counter-notice we will forward it to the original notice-sender. If the sender does not file a court action within 10–14 business days we may restore the removed material.',
        ],
      },
      {
        heading: 'D. Repeat-infringer policy',
        body: [
          'We terminate the accounts of users who are repeat infringers under appropriate circumstances. "Repeat" generally means three or more separate, well-founded notices over any twelve-month period.',
        ],
      },
      {
        heading: 'E. Misrepresentations',
        body: [
          'Any person who knowingly materially misrepresents that material is infringing, or that material was removed by mistake, may be liable for damages under 17 U.S.C. § 512(f). Do not file a notice if you are not the rights-holder or their authorised agent.',
        ],
      },
    ],
  });
}

// ── Cookie Policy ─────────────────────────────────────────────────
export function CookiePolicyPage() {
  return legalShell({
    title: 'Cookie Policy.',
    intro:
      'StemDomeZ uses a small set of first-party cookies that are strictly necessary to deliver the Service, plus an optional UI-preference cookie. We do not use advertising or cross-site tracking cookies.',
    sections: [
      {
        heading: 'A. Cookies we set',
        body: [
          'sd_session — strictly necessary. HttpOnly, SameSite=Lax, Secure in production. Identifies your authenticated session. Lifespan 30 days from last use; deleted on sign-out.',
          'sd_visitor — strictly necessary for anonymous funnel analytics. HttpOnly. 90-day lifespan; ties multiple page views from the same browser to a single visitor identifier so we can compute conversion rates without identifying you personally.',
          'sd_contrast — preference. Only set when you flip the AAA contrast toggle (and only when an admin has enabled the toggle on the site). Lifespan: until you flip it off.',
        ],
      },
      {
        heading: 'B. Third-party cookies',
        body: [
          'Stripe Checkout (when payments are enabled) sets cookies on stripe.com when you are redirected for payment. Their cookies are governed by Stripe’s privacy policy.',
          'No other third party sets cookies on stemdomez.com.',
        ],
      },
      {
        heading: 'C. How to opt out',
        body: [
          'You can clear or block cookies through your browser settings. If you block sd_session you cannot stay signed in. If you block sd_visitor we lose anonymous funnel attribution but the Service still works.',
        ],
      },
    ],
  });
}

// ── Refund Policy ─────────────────────────────────────────────────
export function RefundPolicyPage() {
  return legalShell({
    title: 'Refund Policy.',
    intro:
      'StemDomeZ is currently in a free MVP launch — STL downloads are free for logged-in accounts and no refund situation arises. This policy applies once paid downloads or paid printed-and-shipped products are re-enabled.',
    sections: [
      {
        heading: 'A. STL downloads (digital)',
        body: [
          'Refundable within 14 days of purchase if you have not yet downloaded the file or if the file failed to slice through no fault of your own.',
          'Once a file has been downloaded successfully, it is considered delivered and is non-refundable.',
        ],
      },
      {
        heading: 'B. Printed-and-shipped products',
        body: [
          'Materially defective on arrival (cracked cap, missing thread, wrong size): full refund or replacement at our option, within 14 days of receipt.',
          'Buyer’s remorse: non-refundable; printed parts are made-to-order.',
          'Lost in transit: replacement once the carrier confirms loss.',
        ],
      },
      {
        heading: 'C. How to request a refund',
        body: [
          'Email help@stemdomez.com with your order id and a brief description of the issue. We respond within 2 business days. Refunds are issued back to the original payment method via Stripe.',
        ],
      },
    ],
  });
}

// ── Photo / Likeness Submission Policy ────────────────────────────
export function PhotoPolicyPage() {
  return legalShell({
    title: 'Photo & Likeness Policy.',
    intro:
      'You can only upload photos to StemDomeZ that you have the legal right to use AND that depict an adult who has consented. This policy explains what that means in practice and how we enforce it.',
    sections: [
      {
        heading: 'A. Who you can upload',
        body: [
          'Yourself — always allowed (subject to the rest of these policies).',
          'Another adult who has given you express, informed, and revocable consent to be uploaded, processed by an AI 3D-reconstruction model, and rendered as a physical 3D-printable object you may share or distribute.',
          'Public figures, celebrities, government officials: only with their documented written consent.',
        ],
      },
      {
        heading: 'B. Who you cannot upload',
        body: [
          'Anyone under the age of 18, no exceptions.',
          'Anyone who has not given you informed, express consent.',
          'Anyone whose likeness rights you do not have authorisation to use.',
        ],
      },
      {
        heading: 'C. Withdrawing consent',
        body: [
          'If a person you uploaded a photo of asks you to remove their likeness, you must delete the corresponding designs in /account immediately. They may also write directly to abuse@stemdomez.com and we will remove the underlying photos and STLs from your account on their behalf within 7 days.',
        ],
      },
      {
        heading: 'D. Pre-screen + escalation',
        body: [
          'We run automated pre-screen checks for nudity, minor likeness, and recognised public figures. These are heuristic and may produce both false positives (rejecting valid uploads) and false negatives (allowing prohibited uploads through). The pre-screen is supplementary to, not a substitute for, your obligation under the Acceptable Use Policy.',
          'Suspicious uploads may be escalated to manual review. If we determine in good faith that an upload violates this policy, we will delete it and may suspend the account.',
        ],
      },
    ],
  });
}

// ── Security disclosure (existing) ────────────────────────────────
export function SecurityPage() {
  return legalShell({
    title: 'Security Disclosure.',
    intro:
      'Found a security issue? Thank you. We take reports seriously and want to make it easy to do the right thing.',
    sections: [
      {
        heading: 'Reporting',
        body: [
          'Email: security@stemdomez.com (PGP key available on request)',
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

// ── 404 / 500 (existing) ──────────────────────────────────────────
export function NotFoundPage() {
  return legalShell({
    title: '404 — that head isn’t in the workshop.',
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
    title: '500 — something cracked the cap.',
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
            : 'If it keeps happening, drop us a line at help@stemdomez.com.',
        ],
      },
    ],
  });
}
