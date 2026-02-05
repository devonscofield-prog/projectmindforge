import type { Json } from '@/integrations/supabase/types';

/**
 * Base persona fields shared across all contexts.
 */
export interface PersonaBase {
  id: string;
  name: string;
  persona_type: string;
  disc_profile: string | null;
  difficulty_level: string;
  industry: string | null;
  backstory: string | null;
  voice: string;
}

/**
 * Persona as used in client-side roleplay components (RoleplaySession, RoleplayBriefing).
 * Fields like communication_style, common_objections, pain_points are parsed into typed shapes.
 */
export interface PersonaClient extends PersonaBase {
  communication_style: Record<string, unknown> | null;
  common_objections?: Array<{ objection: string; category: string; severity: string }>;
  pain_points?: Array<{ pain: string; severity: string; visible: boolean }>;
  dos_and_donts?: { dos: string[]; donts: string[] };
}

/**
 * Full persona as stored in the database, used in admin components.
 * JSON columns remain as Json type for flexibility.
 */
export interface PersonaFull extends PersonaBase {
  is_active: boolean;
  communication_style: Json | null;
  common_objections: Json | null;
  pain_points: Json | null;
  dos_and_donts: Json | null;
  grading_criteria: Json | null;
  technical_environment: Json | null;
  created_at: string;
}
