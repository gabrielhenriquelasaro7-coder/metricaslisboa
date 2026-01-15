import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Trash2, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProjectLogoUploadProps {
  projectId?: string;
  currentUrl: string | null;
  projectName: string;
  onUpload: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ProjectLogoUpload({ 
  projectId, 
  currentUrl, 
  projectName, 
  onUpload,
  size = 'md' 
}: ProjectLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = projectId 
        ? `${projectId}.${fileExt}` 
        : `temp-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Delete existing logo if there is one
      if (currentUrl && projectId) {
        const oldFileName = currentUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('project-logos').remove([oldFileName]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('project-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('project-logos')
        .getPublicUrl(filePath);

      const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // Add timestamp to bust cache
      onUpload(publicUrl);
      toast.success('Logo atualizada!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao fazer upload da logo');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentUrl) return;

    setUploading(true);
    try {
      // Extract filename from URL
      const fileName = currentUrl.split('/').pop()?.split('?')[0];
      if (fileName) {
        await supabase.storage.from('project-logos').remove([fileName]);
      }
      setPreviewUrl(null);
      onUpload(null);
      toast.success('Logo removida!');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Erro ao remover logo');
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || currentUrl;
  const initials = projectName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], 'border-2 border-border')}>
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt={projectName} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Overlay for upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-pointer disabled:cursor-not-allowed"
          )}
        >
          {uploading ? (
            <Loader2 className={cn(iconSizes[size], "text-white animate-spin")} />
          ) : (
            <Camera className={cn(iconSizes[size], "text-white")} />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {displayUrl ? 'Alterar' : 'Adicionar logo'}
        </Button>

        {displayUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveLogo}
            disabled={uploading}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
