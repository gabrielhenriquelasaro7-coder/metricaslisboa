import { useState, useEffect } from 'react';
import { useTabVisibilityManagement, TabKey, TAB_LABELS, HIDDEN_BY_DEFAULT_TABS } from '@/hooks/useTabVisibility';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useCargo } from '@/hooks/useCargo';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, Lock, ShieldCheck, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const ALL_TABS: TabKey[] = [
  'dashboard',
  'campaigns',
  'creatives',
  'ai-assistant',
  'predictive',
  'suggestions',
  'whatsapp',
  'financial',
  'settings',
  'admin',
  'analytics',
  'instagram',
  'clarity',
  'diagnostico',
];

interface GuestUser {
  id: string;
  guest_user_id: string;
  guest_name: string;
  guest_email: string;
  project_name: string;
  status: string;
}

export function TabVisibilityManager() {
  const { isTech } = useCargo();
  const { users, loading: usersLoading } = useUserManagement();
  const { getHiddenTabs, getEnabledTabs, toggleTab, loading: visibilityLoading } = useTabVisibilityManagement();

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Fetch guests with user_id
  useEffect(() => {
    const fetchGuests = async () => {
      setGuestsLoading(true);
      try {
        const { data, error } = await supabase
          .from('guest_invitations')
          .select(`
            id,
            guest_user_id,
            guest_name,
            guest_email,
            status,
            project_id,
            projects:project_id (name)
          `)
          .not('guest_user_id', 'is', null);

        if (error) throw error;

        // Group by guest_user_id to avoid duplicates
        const guestMap = new Map<string, GuestUser>();
        (data || []).forEach((g: any) => {
          if (g.guest_user_id && !guestMap.has(g.guest_user_id)) {
            guestMap.set(g.guest_user_id, {
              id: g.id,
              guest_user_id: g.guest_user_id,
              guest_name: g.guest_name,
              guest_email: g.guest_email,
              project_name: g.projects?.name || 'Unknown',
              status: g.status,
            });
          }
        });

        setGuests(Array.from(guestMap.values()));
      } catch (error) {
        console.error('Error fetching guests:', error);
      } finally {
        setGuestsLoading(false);
      }
    };

    if (isTech) {
      fetchGuests();
    } else {
      setGuestsLoading(false);
    }
  }, [isTech]);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const selectedGuest = guests.find(g => g.guest_user_id === selectedGuestId);

  const currentUserId = activeTab === 'users' ? selectedUserId : selectedGuestId;
  const hiddenTabs = currentUserId ? getHiddenTabs(currentUserId) : [];
  const enabledTabs = currentUserId ? getEnabledTabs(currentUserId) : [];

  if (!isTech) {
    return (
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Lock className="w-12 h-12 mb-4 opacity-50" />
          <p>Only Tech can manage tab visibility</p>
        </CardContent>
      </Card>
    );
  }

  const handleToggleTab = async (tab: TabKey) => {
    if (!currentUserId) return;

    setIsSaving(true);
    try {
      await toggleTab(currentUserId, tab);

      const isHiddenByDefault = HIDDEN_BY_DEFAULT_TABS.includes(tab);
      if (isHiddenByDefault) {
        const isNowEnabled = !enabledTabs.includes(tab);
        toast.success(`Tab "${TAB_LABELS[tab]}" ${isNowEnabled ? 'enabled' : 'hidden'}`);
      } else {
        const isNowHidden = !hiddenTabs.includes(tab);
        toast.success(`Tab "${TAB_LABELS[tab]}" ${isNowHidden ? 'hidden' : 'enabled'}`);
      }
    } catch (error) {
      toast.error('Error updating visibility');
    } finally {
      setIsSaving(false);
    }
  };

  const isTabVisible = (tab: TabKey): boolean => {
    if (HIDDEN_BY_DEFAULT_TABS.includes(tab)) {
      return enabledTabs.includes(tab);
    }
    return !hiddenTabs.includes(tab);
  };

  const loading = usersLoading || visibilityLoading || guestsLoading;

  const renderTabConfig = (userId: string | null, userName: string | null, userInfo?: string) => {
    if (!userId) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a user to configure visibility</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">
            Configuring: <span className="text-primary">{userName}</span>
          </p>
          {userInfo && (
            <p className="text-xs text-muted-foreground">{userInfo}</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Visible tabs:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ALL_TABS.map(tab => {
              const visible = isTabVisible(tab);
              const isHiddenByDefault = HIDDEN_BY_DEFAULT_TABS.includes(tab);

              return (
                <div
                  key={tab}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${!visible ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'
                    } ${isHiddenByDefault ? 'ring-1 ring-amber-500/30' : ''}`}
                >
                  <Checkbox
                    id={`tab-${tab}`}
                    checked={visible}
                    disabled={isSaving}
                    onCheckedChange={() => handleToggleTab(tab)}
                  />
                  <Label
                    htmlFor={`tab-${tab}`}
                    className={`flex items-center gap-2 cursor-pointer ${!visible ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {!visible ? (
                      <EyeOff className="w-4 h-4 text-destructive" />
                    ) : (
                      <Eye className="w-4 h-4 text-metric-positive" />
                    )}
                    {TAB_LABELS[tab]}
                    {isHiddenByDefault && (
                      <ShieldCheck className="w-3 h-3 text-amber-500" />
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1">💡 How it works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Check the tabs you want to enable for this user</li>
            <li>Tabs with <ShieldCheck className="w-3 h-3 inline text-amber-500" /> are <strong>hidden by default</strong> and need to be manually enabled</li>
            <li>The <strong>Admin</strong> tab is hidden for everyone until enabled</li>
            <li>This configuration is per individual user</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Tab Visibility
        </CardTitle>
        <CardDescription>
          Manage which tabs each user or guest can see
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Team Members ({users.length})
              </TabsTrigger>
              <TabsTrigger value="guests" className="gap-2">
                <UserCheck className="w-4 h-4" />
                Guests ({guests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.email} ({user.cargo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {renderTabConfig(
                selectedUserId,
                selectedUser?.full_name || selectedUser?.email || null,
                selectedUser ? `Role: ${selectedUser.cargo} | Squad: ${selectedUser.squad_name || 'No squad'}` : undefined
              )}
            </TabsContent>

            <TabsContent value="guests" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Guest</Label>
                <Select value={selectedGuestId} onValueChange={setSelectedGuestId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No guests with active accounts
                      </SelectItem>
                    ) : (
                      guests.map(guest => (
                        <SelectItem key={guest.guest_user_id} value={guest.guest_user_id}>
                          {guest.guest_name} ({guest.guest_email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {guests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No guests with active accounts yet</p>
                  <p className="text-xs mt-2">Guests will appear here after they log in for the first time</p>
                </div>
              ) : (
                renderTabConfig(
                  selectedGuestId,
                  selectedGuest?.guest_name || null,
                  selectedGuest ? `Email: ${selectedGuest.guest_email}` : undefined
                )
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}