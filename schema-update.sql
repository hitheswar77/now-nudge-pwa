ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS locations jsonb DEFAULT '[]'::jsonb;
