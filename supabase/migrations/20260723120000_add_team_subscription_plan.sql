-- Add Team plan to subscription_plan enum (legacy enterprise values remain for existing rows)

ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'team';
