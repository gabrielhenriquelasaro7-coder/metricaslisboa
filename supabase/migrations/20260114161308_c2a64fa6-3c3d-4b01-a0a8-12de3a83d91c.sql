-- Add password_changed flag to track if user changed their default password
ALTER TABLE public.user_management 
ADD COLUMN IF NOT EXISTS needs_password_change BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS temp_password TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update existing users to not need password change (they're already in the system)
UPDATE public.user_management SET needs_password_change = false WHERE needs_password_change IS NULL;