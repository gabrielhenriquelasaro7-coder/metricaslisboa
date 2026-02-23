import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Image as ImageIcon, Video, Loader2, CheckCircle2, CalendarIcon, Upload, Clock, MapPin, Hash, AtSign, X, Plus, Layers, Sparkles } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('content');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);

  const isScheduled = initialDate && initialDate > new Date();
  const projectId = localStorage.getItem('selectedProjectId');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    addFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = (selected: File[]) => {
    const newFiles: FileItem[] = selected.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));
    const allFiles = [...files, ...newFiles];
    setFiles(allFiles);
    if (allFiles.length > 1) {
      setMediaType('CAROUSEL');
    } else if (allFiles[0]?.type === 'video') {
      setMediaType('VIDEO');
    } else {
      setMediaType('IMAGE');
    }
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (droppedFiles.length) addFiles(droppedFiles);
  };

  const handlePublish = async () => {
    if (!files.length) { toast.error('Selecione pelo menos um arquivo de mídia'); return; }
    if (!projectId) { toast.error('Nenhum projeto selecionado'); return; }

    setLoading(true);
    try {
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
    setActiveTab('content');
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
    onClose();
  };

  const charCount = caption.length;
  const hashtagCount = hashtags ? hashtags.split(/\s+/).filter(h => h.startsWith('#')).length : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isScheduled ? <CalendarIcon className="h-5 w-5 text-primary" /> : <Send className="h-5 w-5 text-primary" />}
            {isScheduled ? 'Agendar Publicação' : 'Nova Publicação'}
          </DialogTitle>
          {isScheduled && (
            <p className="text-xs text-muted-foreground mt-1">
              Agende sua publicação para ser postada automaticamente no Instagram.
            </p>
          )}
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6">
            <div className="p-4 rounded-full bg-primary/10">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{isScheduled ? 'Post agendado!' : 'Post publicado!'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isScheduled ? 'Seu post será publicado no horário agendado.' : 'Seu post já está disponível no Instagram.'}
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Media Type Tabs */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Tipo de Conteúdo</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'IMAGE', icon: ImageIcon, label: 'Imagem' },
                    { value: 'VIDEO', icon: Video, label: 'Reels' },
                    { value: 'CAROUSEL', icon: Layers, label: 'Carrossel' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setMediaType(value as any)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                        mediaType === value
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Upload */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Mídia</Label>
                {files.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {files.map((f, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square group">
                          {f.type === 'image' ? (
                            <img src={f.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video src={f.preview} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-white hover:bg-destructive/70" onClick={() => removeFile(i)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {f.type === 'video' && <Video className="absolute bottom-1 right-1 h-3 w-3 text-white drop-shadow" />}
                        </div>
                      ))}
                      <div
                        className="rounded-lg border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground mt-0.5">Adicionar</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3 w-3" /> Upload Manual
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        {files.length} arquivo{files.length > 1 ? 's' : ''} selecionado{files.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={dragAreaRef}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          JPG, PNG, MP4, MOV • Máx 50MB • Múltiplos para carrossel
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

              {/* Caption */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Legenda</Label>
                <Textarea
                  placeholder="Escreva a legenda do post..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={5}
                  className="resize-none text-sm"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Hashtags
                    </button>
                    <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <AtSign className="h-3 w-3" /> Menções
                    </button>
                  </div>
                  <span className={`text-[10px] ${charCount > 2200 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {charCount} / 2.200
                  </span>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Localização
                    </Label>
                    <Input placeholder="Ex: São Paulo, SP" value={location} onChange={(e) => setLocation(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {isScheduled && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Horário
                      </Label>
                      <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Hashtags
                  </Label>
                  <Input placeholder="#marketing #socialmedia #branding" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="h-8 text-sm" />
                  {hashtagCount > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">{hashtagCount}/30 hashtags</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <AtSign className="h-3 w-3" /> Primeiro Comentário
                  </Label>
                  <Textarea
                    placeholder="Hashtags extras ou menções..."
                    value={firstComment}
                    onChange={(e) => setFirstComment(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t border-border shrink-0 gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose} className="h-9">Cancelar</Button>
              <Button onClick={handlePublish} disabled={loading || !files.length} className="h-9 gap-2">
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
