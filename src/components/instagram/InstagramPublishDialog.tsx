import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Image as ImageIcon, Video, Loader2, CheckCircle2, CalendarIcon, Upload, Clock, MapPin, Hash, AtSign, X, Plus, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: Date | null;
}

interface FileItem {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export default function InstagramPublishDialog({ open, onClose, initialDate }: Props) {
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | 'CAROUSEL'>('IMAGE');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isScheduled = initialDate && initialDate > new Date();
  const projectId = localStorage.getItem('selectedProjectId');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const newFiles: FileItem[] = selected.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));

    const allFiles = [...files, ...newFiles];
    setFiles(allFiles);

    // Auto-detect type
    if (allFiles.length > 1) {
      setMediaType('CAROUSEL');
    } else if (allFiles[0]?.type === 'video') {
      setMediaType('VIDEO');
    } else {
      setMediaType('IMAGE');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const updated = [...files];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    setFiles(updated);
    if (updated.length <= 1 && mediaType === 'CAROUSEL') {
      setMediaType(updated[0]?.type === 'video' ? 'VIDEO' : 'IMAGE');
    }
  };

  const handlePublish = async () => {
    if (!files.length) { toast.error('Selecione pelo menos um arquivo de mídia'); return; }
    if (!projectId) { toast.error('Nenhum projeto selecionado'); return; }

    setLoading(true);
    try {
      // Upload all files
      const uploadedUrls: string[] = [];
      for (const f of files) {
        const fileExt = f.file.name.split('.').pop();
        const fileName = `instagram/${projectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('instagram-media')
          .upload(fileName, f.file, { contentType: f.file.type });
        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('instagram-media').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const fullCaption = [
        caption,
        location ? `📍 ${location}` : '',
        hashtags ? `\n\n${hashtags}` : '',
      ].filter(Boolean).join('\n');

      if (isScheduled) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const scheduledAt = new Date(initialDate!);
        scheduledAt.setHours(hours, minutes, 0, 0);

        const { error } = await supabase.from('instagram_scheduled_posts').insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          caption: fullCaption,
          media_url: uploadedUrls[0],
          media_type: mediaType === 'CAROUSEL' ? 'CAROUSEL_ALBUM' : mediaType,
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
            media_url: uploadedUrls[0],
            media_urls: mediaType === 'CAROUSEL' ? uploadedUrls : undefined,
            media_type: mediaType === 'CAROUSEL' ? 'CAROUSEL_ALBUM' : mediaType,
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
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
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
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Mídia * {files.length > 1 && <Badge variant="secondary" className="text-[10px]"><Layers className="h-3 w-3 mr-1" />Carrossel ({files.length})</Badge>}
                </Label>

                {/* Files preview grid */}
                {files.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square group">
                        {f.type === 'image' ? (
                          <img src={f.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <video src={f.preview} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-white hover:bg-red-500/50" onClick={() => removeFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {f.type === 'video' && <Video className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white" />}
                      </div>
                    ))}
                    {/* Add more button */}
                    <div
                      className="rounded-lg border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground mt-1">Adicionar</span>
                    </div>
                  </div>
                )}

                {files.length === 0 && (
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
                          JPG, PNG, MP4, MOV • Máx 50MB • Múltiplos arquivos para carrossel
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  className="hidden"
                  multiple
                  onChange={handleFileChange}
                />
              </div>

              {/* Media Type */}
              <div className="space-y-2">
                <Label>Tipo de Publicação</Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMAGE">
                      <span className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Imagem (Feed)</span>
                    </SelectItem>
                    <SelectItem value="VIDEO">
                      <span className="flex items-center gap-2"><Video className="h-3.5 w-3.5" /> Vídeo / Reels</span>
                    </SelectItem>
                    <SelectItem value="CAROUSEL">
                      <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Carrossel</span>
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
                <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Localização</Label>
                <Input placeholder="Ex: São Paulo, SP" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Hashtags</Label>
                <Input placeholder="#marketing #socialmedia #branding" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Máx. 30 hashtags separadas por espaço</p>
              </div>

              {/* First Comment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" /> Primeiro Comentário</Label>
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
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Horário de Publicação</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Horário de Brasília (UTC-3).</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handlePublish} disabled={loading || !files.length} className="gap-2">
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

// Badge component inline for use in labels
function Badge({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground ${className}`}>{children}</span>;
}
