-- Add unique constraint on email for user_management
ALTER TABLE public.user_management ADD CONSTRAINT user_management_email_key UNIQUE (email);