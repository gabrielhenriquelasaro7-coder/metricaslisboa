import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExternalLink, Instagram } from 'lucide-react';
import type { InstagramAccount } from '@/hooks/useInstagramData';

interface Props {
  account: InstagramAccount;
}

export default function InstagramProfileHeader({ account }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-6">
        <Avatar className="h-20 w-20 border-2 border-primary/20">
          <AvatarImage src={account.profile_picture_url || ''} alt={account.username || ''} />
          <AvatarFallback><Instagram className="h-8 w-8" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="text-xl font-bold">{account.name || account.username}</h2>
            {account.username && <span className="text-muted-foreground text-sm">@{account.username}</span>}
          </div>
          {account.biography && <p className="text-sm text-muted-foreground max-w-lg">{account.biography}</p>}
          {account.website && (
            <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 justify-center sm:justify-start hover:underline">
              <ExternalLink className="h-3 w-3" />{account.website}
            </a>
          )}
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-2xl font-bold">{(account.followers_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Seguidores</p></div>
          <div><p className="text-2xl font-bold">{(account.media_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Publicações</p></div>
          <div><p className="text-2xl font-bold">{(account.follows_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Seguindo</p></div>
        </div>
      </CardContent>
    </Card>
  );
}
