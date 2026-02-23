import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Image as ImageIcon, Video, Loader2, CheckCircle2, CalendarIcon } from 'lucide-react';
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
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isScheduled = initialDate && initialDate > new Date();
  const projectId = localStorage.getItem('selectedProjectId');

  const handlePublish = async () => {
    if (!mediaUrl) { toast.error('URL da mídia é obrigatória'); return; }
    if (!projectId) { toast.error('Nenhum projeto selecionado'); return; }

    setLoading(true);
    try {
      if (isScheduled) {
        const { error } = await supabase.from('instagram_scheduled_posts').insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          caption,
          media_url: mediaUrl,
          media_type: mediaType,
          status: 'scheduled',
          scheduled_at: initialDate!.toISOString(),
        });
        if (error) throw error;
        toast.success('Post agendado!');
      } else {
        const { data, error } = await supabase.functions.invoke('instagram-publish', {
          body: { project_id: projectId, action: 'publish_now', caption, media_url: mediaUrl, media_type: mediaType },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success('Post publicado!');
      }
      setSuccess(true);
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption(''); setMediaUrl(''); setMediaType('IMAGE'); setSuccess(false); setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isScheduled ? <CalendarIcon className="h-5 w-5 text-primary" /> : <Send className="h-5 w-5 text-primary" />}
            {isScheduled ? `Agendar para ${format(initialDate!, 'dd/MM/yyyy')}` : 'Publicar Agora'}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">{isScheduled ? 'Post agendado!' : 'Post publicado!'}</p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL da Mídia *</Label>
                <Input placeholder="https://exemplo.com/imagem.jpg" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">A imagem/vídeo deve estar em uma URL pública.</p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Mídia</Label>
                <Select value={mediaType} onValueChange={setMediaType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMAGE"><span className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Imagem</span></SelectItem>
                    <SelectItem value="VIDEO"><span className="flex items-center gap-2"><Video className="h-3.5 w-3.5" /> Vídeo / Reels</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea placeholder="Escreva a legenda..." value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="resize-none" />
                <p className="text-[10px] text-muted-foreground text-right">{caption.length} / 2.200</p>
              </div>

              {mediaUrl && mediaType === 'IMAGE' && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img src={mediaUrl} alt="Preview" className="w-full max-h-48 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handlePublish} disabled={loading || !mediaUrl} className="gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : isScheduled ? <><CalendarIcon className="h-4 w-4" /> Agendar</> : <><Send className="h-4 w-4" /> Publicar</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
