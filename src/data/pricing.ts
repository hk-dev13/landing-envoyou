export type PlanId = 'starter' | 'pro' | 'team';

export type PricingFeatureId =
  | 'editorial_refinement'
  | 'seo_package'
  | 'editorial_profile'
  | 'analysis_history'
  | 'advanced_fact_checking'
  | 'cms_export'
  | 'ai_drafting'
  | 'shared_workspace'
  | 'team_collaboration'
  | 'team_analytics'
  | 'organization_roles';

export type PricingFeature = {
  label: string;
  availability: Record<PlanId, boolean>;
};

export type PricingPlan = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  creditsMonthly: number;
  description: string;
  cardFeatureIds: PricingFeatureId[];
  highlight: boolean;
};

/*
 * Landing presentation snapshot of the production EAI pricing contract.
 * Checkout remains authoritative for the final charge and plan eligibility.
 * Prices and monthly credit allowances were verified against
 * EAI/packages/shared/src/payment.ts on 28 July 2026.
 */
export const pricingFeatures: Record<PricingFeatureId, PricingFeature> = {
  editorial_refinement: {
    label: 'Full Editorial Refinement Pipeline',
    availability: { starter: true, pro: true, team: true },
  },
  seo_package: {
    label: 'SEO Publication Package',
    availability: { starter: true, pro: true, team: true },
  },
  editorial_profile: {
    label: 'Custom Editorial Profile',
    availability: { starter: true, pro: true, team: true },
  },
  analysis_history: {
    label: 'Analysis History',
    availability: { starter: true, pro: true, team: true },
  },
  advanced_fact_checking: {
    label: 'Advanced Fact Checking',
    availability: { starter: false, pro: true, team: true },
  },
  cms_export: {
    label: 'Configured CMS Draft Export',
    availability: { starter: false, pro: true, team: true },
  },
  ai_drafting: {
    label: 'AI Drafting Assistant',
    availability: { starter: false, pro: true, team: true },
  },
  shared_workspace: {
    label: 'Shared Workspace',
    availability: { starter: false, pro: false, team: true },
  },
  team_collaboration: {
    label: 'Team Collaboration',
    availability: { starter: false, pro: false, team: true },
  },
  team_analytics: {
    label: 'Team Analytics',
    availability: { starter: false, pro: false, team: true },
  },
  organization_roles: {
    label: 'Organization Member Roles',
    availability: { starter: false, pro: false, team: true },
  },
};

export const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 10,
    priceYearly: 96,
    creditsMonthly: 50,
    description: 'For independent writers and journalists building a consistent publishing workflow.',
    cardFeatureIds: [
      'editorial_refinement',
      'seo_package',
      'editorial_profile',
      'analysis_history',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 19,
    priceYearly: 182,
    creditsMonthly: 100,
    description: 'For professional editors who need deeper verification and publishing integrations.',
    cardFeatureIds: [
      'editorial_refinement',
      'advanced_fact_checking',
      'cms_export',
      'ai_drafting',
    ],
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthly: 79,
    priceYearly: 758,
    creditsMonthly: 300,
    description: 'For editorial teams that need a shared workspace, roles, and centralized oversight.',
    cardFeatureIds: [
      'shared_workspace',
      'team_collaboration',
      'team_analytics',
      'organization_roles',
    ],
    highlight: false,
  },
];

export const pricingComparison = Object.values(pricingFeatures).map(
  ({ label, availability }) => ({
    name: label,
    ...availability,
  }),
);

export const creditComparison = {
  name: 'Editorial Credits',
  starter: `${pricingPlans.find((plan) => plan.id === 'starter')?.creditsMonthly}/month`,
  pro: `${pricingPlans.find((plan) => plan.id === 'pro')?.creditsMonthly}/month`,
  team: `${pricingPlans.find((plan) => plan.id === 'team')?.creditsMonthly}/month`,
};
