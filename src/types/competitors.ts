export interface CompetitorOverview {
  company_name: string;
  tagline?: string;
  description: string;
  founded_year?: string;
  headquarters?: string;
  employee_count?: string;
  target_market: string;
}

export interface CompetitorProduct {
  name: string;
  description: string;
  key_features?: string[];
}

export interface PricingTier {
  name: string;
  price: string;
  features?: string[];
}

export interface CompetitorPricing {
  model?: string;
  tiers?: PricingTier[];
  notes?: string;
}

export interface CompetitorPositioning {
  value_proposition?: string;
  key_differentiators?: string[];
  target_personas?: string[];
  messaging_themes?: string[];
}

export interface CompetitorWeakness {
  area: string;
  description: string;
  how_to_exploit: string;
}

export interface WhyWeWinPoint {
  point: string;
  talk_track: string;
}

export interface TrapQuestion {
  question: string;
  why_it_works: string;
  expected_response?: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface Landmine {
  topic: string;
  warning: string;
  pivot: string;
}

export interface CompetitorBattlecard {
  why_we_win: WhyWeWinPoint[];
  trap_questions: TrapQuestion[];
  objection_handlers: ObjectionHandler[];
  landmines?: Landmine[];
}

export interface CompetitorIntel {
  overview: CompetitorOverview;
  products: CompetitorProduct[];
  pricing?: CompetitorPricing;
  positioning?: CompetitorPositioning;
  weaknesses: CompetitorWeakness[];
  battlecard: CompetitorBattlecard;
}

export interface CompetitorBranding {
  colorScheme?: string;
  logo?: string;
  colors?: Record<string, string>;
  fonts?: Array<{ family: string }>;
  images?: {
    logo?: string;
    favicon?: string;
    ogImage?: string;
  };
}

export interface Competitor {
  id: string;
  name: string;
  website: string;
  logo_url: string | null;
  raw_content: Record<string, unknown>;
  intel: CompetitorIntel | null;
  branding: CompetitorBranding | null;
  last_researched_at: string | null;
  research_status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
