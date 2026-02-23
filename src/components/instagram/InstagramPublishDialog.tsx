import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Image as ImageIcon, Video, Loader2, CheckCircle2, CalendarIcon, Upload, Clock, MapPin, Hash, AtSign, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: Date | null;
}

export default function InstagramPublishDialog({ open, onClose, initialDate }: Props) {
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isScheduled = initialDate && initialDate > new Date();
  const projectId = localStorage.getItem('selectedProjectId');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    
    // Auto-detect media type
    if (selected.type.startsWith('video/')) {
      setMediaType('VIDEO');
    } else {
      setMediaType('IMAGE');
    }

    // Create preview
    const url = URL.createObjectURL(selected);
    setFilePreview(url);
  };

  const removeFile = () => {
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = async () => {
    if (!file) { toast.error('Selecione um arquivo de mídia'); return; }
    if (!projectId) { toast.error('Nenhum projeto selecionado'); return; }

    setLoading(true);
    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `instagram/${projectId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('instagram-media')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('instagram-media')
        .getPublicUrl(fileName);

      const fullCaption = [
        caption,
        location ? `📍 ${location}` : '',
        hashtags ? `\n\n${hashtags}` : '',
      ].filter(Boolean).join('\n');

      if (isScheduled) {
        // Build scheduled datetime
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const scheduledAt = new Date(initialDate!);
        scheduledAt.setHours(hours, minutes, 0, 0);

        const { error } = await supabase.from('instagram_scheduled_posts').insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          caption: fullCaption,
          media_url: publicUrl,
          media_type: mediaType,
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString(),
        });
        if (error) throw error;
        toast.success('Post agendado!', {
          description: `Agendado para ${format(scheduledAt, 'dd/MM/yyyy')} às ${scheduleTime}`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('instagram-publish', {
          body: {
            project_id: projectId,
            action: 'publish_now',
            caption: fullCaption,
            media_url: publicUrl,
            media_type: mediaType,
            first_comment: firstComment || undefined,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Post publicado no Instagram!');
      }
      setSuccess(true);
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption(''); setMediaType('IMAGE'); setSuccess(false); setLoading(false);
    setLocation(''); setHashtags(''); setFirstComment(''); setScheduleTime('10:00');
    removeFile();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isScheduled ? <CalendarIcon className="h-5 w-5 text-primary" /> : <Send className="h-5 w-5 text-primary" />}
            {isScheduled ? `Agendar para ${format(initialDate!, 'dd/MM/yyyy')}` : 'Publicar Agora'}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">{isScheduled ? 'Post agendado com sucesso!' : 'Post publicado com sucesso!'}</p>
            <p className="text-sm text-muted-foreground">Sincronize para ver a publicação no dashboard.</p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Mídia *
                </Label>
                {!file ? (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 rounded-full bg-secondary">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Clique para selecionar</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          JPG, PNG, MP4, MOV • Máx 50MB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    {filePreview && mediaType === 'IMAGE' && (
                      <img src={filePreview} alt="Preview" className="w-full max-h-56 object-contain bg-secondary" />
                    )}
                    {filePreview && mediaType === 'VIDEO' && (
                      <video src={filePreview} controls className="w-full max-h-56 object-contain bg-secondary" />
                    )}
                    <div className="flex items-center justify-between p-2 bg-secondary/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                        {mediaType === 'VIDEO' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{file.name}</span>
                        <span className="shrink-0">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={removeFile}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Media Type Override */}
              <div className="space-y-2">
                <Label>Tipo de Publicação</Label>
                <Select value={mediaType} onValueChange={setMediaType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMAGE">
                      <span className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Imagem (Feed)</span>
                    </SelectItem>
                    <SelectItem value="VIDEO">
                      <span className="flex items-center gap-2"><Video className="h-3.5 w-3.5" /> Vídeo / Reels</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea
                  placeholder="Escreva a legenda do post..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right">{caption.length} / 2.200</p>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Localização
                </Label>
                <Input
                  placeholder="Ex: São Paulo, SP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> Hashtags
                </Label>
                <Input
                  placeholder="#marketing #socialmedia #branding"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Máx. 30 hashtags separadas por espaço</p>
              </div>

              {/* First Comment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <AtSign className="h-3.5 w-3.5" /> Primeiro Comentário
                </Label>
                <Textarea
                  placeholder="Adicione hashtags extras ou menções no primeiro comentário..."
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Schedule Time */}
              {isScheduled && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Horário de Publicação
                  </Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Horário de Brasília (UTC-3). Escolha o melhor horário para seu público.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handlePublish} disabled={loading || !file} className="gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : isScheduled ? (
                  <><CalendarIcon className="h-4 w-4" /> Agendar</>
                ) : (
                  <><Send className="h-4 w-4" /> Publicar</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
