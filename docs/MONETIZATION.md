# Monetization playbook

The order of operations, and what each step requires. Life-safety
information (fires, evacuations, alerts) stays free at every stage — that is
both an ethical line and the reason people will trust the site enough for
any of this to work.

## Stage 1 — Donations (do at launch)

Add a Ko-fi / Buy Me a Coffee / GitHub Sponsors link to the header or About
page. No code risk, no privacy impact. Public-safety tools convert
surprisingly well right after someone tracks a fire near their home.

## Stage 2 — Display ads (once traffic is real, ~5k+ visits/month)

1. Join Google AdSense; put their line into `public/ads.txt` (template
   already in place).
2. **Before enabling**: ads add tracking, so update `/privacy`, and add a
   consent banner for GDPR jurisdictions. The current "no tracking, no
   banner" stance is a feature — trade it consciously.
3. Expect roughly $1–5 per 1,000 views; disaster-adjacent content is
   sometimes down-ranked by brand-safety filters. Move to a premium network
   (Mediavine/Raptive) at ~50k sessions/month for ~3× rates.

## Stage 3 — Paid alert subscriptions (the durable business)

"Notify me when a fire, evacuation zone, or smoke event appears within X km
of my saved places" at $3–5/month. Needs: Stripe, email/SMS delivery, an
alert engine watching the existing feeds, and account email collection
(update the privacy policy — accounts are currently email-free by design).
The evacuation and fire data pipelines already exist; this is an engineering
project, not a data one.

## Stage 4 — Data/API licensing (B2B)

`openapi.yaml` documents the API. Insurers, utilities, logistics, and media
pay meaningful money for unified wildfire feeds. Gate with per-customer API
keys and a commercial licence note; keep the public map free.

## Also viable

Tasteful sponsorship ("supported by X") and disclosed affiliate links
(air purifiers, emergency kits) during smoke events. Disclose clearly;
never let placement look like safety advice.
