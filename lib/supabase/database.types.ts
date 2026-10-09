/**
 * Supabase database schema types.
 *
 * This is a structural stand-in so the generated client is not typed as `never`.
 * Regenerate a full schema after connecting the live project:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

/** Matches @supabase/supabase-js GenericTable so .from() is not inferred as never. */
type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericView = {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
