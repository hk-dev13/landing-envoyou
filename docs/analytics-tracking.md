# Envoyou Landing Analytics Tracking Plan

Last updated: 24 July 2026

## Scope

- Tool: Google Analytics 4 via `gtag.js`
- Consent: opt-in; the Google script is not loaded before analytics consent
- Privacy boundary: event properties must not contain form answers, email addresses, names, submission IDs, or other personal data

## Events

| Event | Decision supported | Properties | Trigger |
|---|---|---|---|
| `eai_login_clicked` | Which page and CTA send visitors into EAI? | `cta_location`, `destination_host` | A direct EAI login CTA is clicked |
| `eai_outbound_clicked` | Which landing page sends qualified traffic to EAI? | `cta_location`, `destination_host` | An instrumented EAI link is clicked |
| `pricing_plan_selected` | Which plan and billing cycle attract demand? | `cta_location`, `plan`, `billing_cycle`, `destination_host` | A pricing-plan CTA is clicked |

## Recommended GA4 configuration

1. Mark `eai_login_clicked` and `pricing_plan_selected` as key events.
2. Register `cta_location`, `plan`, and `billing_cycle` as event-scoped custom dimensions.
3. Build a funnel from `eai_login_clicked` to authenticated EAI onboarding and first successful refinement.
4. Segment the funnel by landing page, referrer, source, medium, and campaign.
5. Validate events in GA4 DebugView after deployment and consent acceptance.

## Validation checklist

- Events do not fire before analytics consent.
- Rejecting consent does not load Google Analytics.
- Reopening Analytics settings allows the visitor to change the stored preference.
- CTA tracking contains only the on-page location, destination host, and optional plan or billing-cycle labels.
- Pricing plan clicks carry the currently selected monthly or yearly billing cycle.
