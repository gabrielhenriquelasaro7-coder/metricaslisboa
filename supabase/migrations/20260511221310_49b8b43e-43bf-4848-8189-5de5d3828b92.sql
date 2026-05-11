UPDATE public.system_settings SET value = '12345678', updated_at = now() WHERE key = 'admin_password';
INSERT INTO public.system_settings (key, value)
SELECT 'admin_password', '12345678'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'admin_password');