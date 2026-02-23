import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Send, Clock, Image as ImageIcon, Video, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InstagramPublishDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState('publish');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const projectId = localStorage.getItem('selectedProjectId');

  const handlePublish = async () => {
    if (!mediaUrl) {
      toast.error('URL da mídia é obrigatória');
      return;
    }
    if (!projectId) {
      toast.error('Nenhum projeto selecionado');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'schedule') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Data e hora são obrigatórios para agendamento');
          setLoading(false);
          return;
        }
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

        const { error } = await supabase.from('instagram_scheduled_posts').insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          caption,
          media_url: mediaUrl,
          media_type: mediaType,
          status: 'scheduled',
          scheduled_at: scheduledAt,
        });

        if (error) throw error;
        toast.success('Post agendado com sucesso!');
        setSuccess(true);
      } else {
        // Publish now
        const { data, error } = await supabase.functions.invoke('instagram-publish', {
          body: {
            project_id: projectId,
            action: 'publish_now',
            caption,
            media_url: mediaUrl,
            media_type: mediaType,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Post publicado com sucesso!');
        setSuccess(true);
      }
    } catch (e: any) {
      toast.error('Erro ao publicar', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption('');
    setMediaUrl('');
    setMediaType('IMAGE');
    setScheduledDate('');
    setScheduledTime('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Nova Publicação
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">
              {tab === 'schedule' ? 'Post agendado!' : 'Post publicado!'}
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="publish" className="flex-1 gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Publicar Agora
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1 gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Agendar
                </TabsTrigger>
              </TabsList>

              <div className="space-y-4 mt-4">
                {/* Media URL */}
                <div className="space-y-2">
                  <Label>URL da Mídia *</Label>
                  <Input
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    A imagem/vídeo deve estar hospedada em uma URL pública acessível.
                  </p>
                </div>

                {/* Media Type */}
                <div className="space-y-2">
                  <Label>Tipo de Mídia</Label>
                  <Select value={mediaType} onValueChange={setMediaType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IMAGE">
                        <span className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Imagem</span>
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
                  <p className="text-[10px] text-muted-foreground text-right">
                    {caption.length} / 2.200
                  </p>
                </div>

                {/* Schedule fields */}
                <TabsContent value="schedule" className="mt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                    </div>
                  </div>
                </TabsContent>

                {/* Preview */}
                {mediaUrl && (
                  <div className="rounded-lg overflow-hidden border border-border bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground px-3 pt-2">Preview</p>
                    <div className="p-3">
                      {mediaType === 'IMAGE' ? (
                        <img src={mediaUrl} alt="Preview" className="w-full max-h-48 object-contain rounded" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="flex items-center justify-center h-32 bg-secondary rounded text-muted-foreground text-xs">
                          <Video className="h-8 w-8 mr-2" /> Vídeo carregado
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handlePublish} disabled={loading || !mediaUrl} className="gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : tab === 'schedule' ? (
                  <><Clock className="h-4 w-4" /> Agendar Post</>
                ) : (
                  <><Send className="h-4 w-4" /> Publicar Agora</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
