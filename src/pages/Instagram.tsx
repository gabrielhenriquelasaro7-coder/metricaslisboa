import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { RefreshCw, Instagram, AlertTriangle } from 'lucide-react';
import { useInstagramData, type InstagramMedia } from '@/hooks/useInstagramData';
import InstagramProfileHeader from '@/components/instagram/InstagramProfileHeader';
import InstagramMetricsGrid from '@/components/instagram/InstagramMetricsGrid';
import InstagramPerformanceChart from '@/components/instagram/InstagramPerformanceChart';
import InstagramPostsGrid from '@/components/instagram/InstagramPostsGrid';
import InstagramPostDetailModal from '@/components/instagram/InstagramPostDetailModal';
import InstagramDemographics from '@/components/instagram/InstagramDemographics';
import InstagramCalendar from '@/components/instagram/InstagramCalendar';
import InstagramPublishDialog from '@/components/instagram/InstagramPublishDialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstagramPage() {
  const { account, media, insights, loading, syncing, syncInstagram, metrics } = useInstagramData();
  const [selectedPost, setSelectedPost] = useState<InstagramMedia | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);

  const hasInsights = insights.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Instagram</h1>
              <p className="text-xs text-muted-foreground">Social Media Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {account?.last_sync_at && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Sync: {new Date(account.last_sync_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button onClick={syncInstagram} disabled={syncing} size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : !account ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
              <Instagram className="w-10 h-10 text-white" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Instagram ainda não sincronizado</h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Clique em "Sincronizar" para puxar os dados do Instagram. É necessário que o projeto tenha um <strong>Facebook Page ID</strong> configurado.
              </p>
            </div>
            <Button onClick={syncInstagram} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </div>
        ) : (
          <>
            <InstagramProfileHeader account={account} engagementRate={metrics.engagementRate} />

            {!hasInsights && media.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Insights diários não carregados</p>
                  <p className="text-xs text-muted-foreground">Clique em "Sincronizar" novamente. As métricas diárias podem levar até 48h para ficarem disponíveis na API.</p>
                </div>
              </div>
            )}

            <InstagramMetricsGrid metrics={metrics} followersCount={account.followers_count} />
            <InstagramPerformanceChart insights={insights} />
            <InstagramPostsGrid media={media} onSelect={setSelectedPost} />
            <InstagramDemographics insights={insights} />
            <InstagramCalendar media={media} onSelectPost={setSelectedPost} onScheduleDate={setScheduleDate} />

            <InstagramPostDetailModal
              item={selectedPost}
              open={!!selectedPost}
              onClose={() => setSelectedPost(null)}
              profilePic={account.profile_picture_url}
              username={account.username}
            />
            <InstagramPublishDialog
              open={!!scheduleDate}
              onClose={() => setScheduleDate(null)}
              initialDate={scheduleDate}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
