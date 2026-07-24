# Envoyou Landing Analytics Tracking Plan

Last updated: 24 July 2026

## Scope

- Tool: Google Analytics 4 via `gtag.js`
- Consent: opt-in; the Google script is not loaded before analytics consent
- Privacy boundary: event properties must not contain form answers, email addresses, names, submission IDs, or other personal data

## Events

| Event | Decision supported | Properties | Trigger |
|---|---|---|---|
| `beta_access_clicked` | Which page and CTA create beta intent? | `cta_location`, `destination_host` | A beta-access CTA is clicked |
| `eai_outbound_clicked` | Which landing page sends qualified traffic to EAI? | `cta_location`, `destination_host` | An instrumented EAI link is clicked |
| `pricing_plan_selected` | Which plan and billing cycle attract demand? | `cta_location`, `plan`, `billing_cycle`, `destination_host` | A pricing-plan CTA is clicked |
| `tally_form_opened` | How many beta-intent clicks reach the form? | `form_id`, `cta_location` | Tally emits `Tally.FormLoaded` for form `ODy5xM` |
| `tally_form_submitted` | How many visitors complete the beta request? | `form_id`, `cta_location` | Tally emits `Tally.FormSubmitted` for form `ODy5xM` |

## Recommended GA4 configuration

1. Mark `tally_form_submitted` as a key event.
2. Register `cta_location`, `plan`, and `billing_cycle` as event-scoped custom dimensions.
3. Build a funnel from `beta_access_clicked` to `tally_form_opened` to `tally_form_submitted`.
4. Segment the funnel by landing page, referrer, source, medium, and campaign.
5. Validate events in GA4 DebugView after deployment and consent acceptance.

## Validation checklist

- Events do not fire before analytics consent.
- Rejecting consent does not load Google Analytics.
- Reopening Analytics settings allows the visitor to change the stored preference.
- Tally messages are accepted only from `https://tally.so`.
- Tally submission answers and submission identifiers are never read or forwarded.
- Pricing plan clicks carry the currently selected monthly or yearly billing cycle.
