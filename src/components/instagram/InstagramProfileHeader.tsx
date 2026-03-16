import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Instagram, TrendingUp } from 'lucide-react';
import type { InstagramAccount } from '@/hooks/useInstagramData';
import InstagramStoriesViewer from './InstagramStoriesViewer';

interface Props {
  account: InstagramAccount;
  engagementRate?: number;
}

export default function InstagramProfileHeader({ account, engagementRate }: Props) {
  const [storiesOpen, setStoriesOpen] = useState(false);

  // Format biography with line breaks like Instagram does
  const renderBiography = (bio: string) => {
    return bio.split('\n').map((line, i) => (
      <span key={i}>
        {i > 0 && <br />}
        {line}
      </span>
    ));
  };

  return (
    <>
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-6">
          {/* Clickable avatar with story ring */}
          <button
            onClick={() => setStoriesOpen(true)}
            className="relative group cursor-pointer flex-shrink-0"
            title="Ver Stories"
          >
            <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-background">
                {account.profile_picture_url ? (
                  <img src={account.profile_picture_url} alt={account.username || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Instagram className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </button>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h2 className="text-xl font-bold">{account.username || account.name}</h2>
              {engagementRate !== undefined && engagementRate > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  {engagementRate.toFixed(2)}% eng.
                </Badge>
              )}
            </div>

            {account.name && account.username && account.name !== account.username && (
              <p className="text-sm font-semibold">{account.name}</p>
            )}

            {account.biography && (
              <p className="text-sm text-muted-foreground max-w-lg whitespace-pre-line leading-relaxed">
                {renderBiography(account.biography)}
              </p>
            )}

            {account.website && (
              <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 justify-center sm:justify-start hover:underline">
                <ExternalLink className="h-3 w-3" />{account.website}
              </a>
            )}
          </div>

          <div className="flex gap-6 text-center flex-shrink-0">
            <div><p className="text-2xl font-bold">{(account.followers_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Seguidores</p></div>
            <div><p className="text-2xl font-bold">{(account.media_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Publicações</p></div>
            <div><p className="text-2xl font-bold">{(account.follows_count || 0).toLocaleString('pt-BR')}</p><p className="text-xs text-muted-foreground">Seguindo</p></div>
          </div>
        </CardContent>
      </Card>

      <InstagramStoriesViewer
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        profilePic={account.profile_picture_url}
        username={account.username}
      />
    </>
  );
}
