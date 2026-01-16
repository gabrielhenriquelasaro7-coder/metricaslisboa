import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useCargo, UserCargo } from './useCargo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ManagedUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  cargo: UserCargo;
  squad_id: string | null;
  squad_name?: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface UseUserManagementReturn {
  users: ManagedUser[];
  loading: boolean;
  createUser: (data: CreateUserData) => Promise<void>;
  updateUser: (userId: string, data: Partial<CreateUserData>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateUserCargo: (userId: string, cargo: UserCargo) => Promise<void>;
  updateUserSquad: (userId: string, squadId: string | null) => Promise<void>;
  importUsersFromCSV: (users: CSVUserData[]) => Promise<{ success: number; failed: number }>;
  refetch: () => Promise<void>;
}

export interface CreateUserData {
  email: string;
  full_name?: string;
  phone?: string;
  cargo: UserCargo;
  squad_id?: string;
}

export interface CSVUserData {
  name: string;
  phone: string;
  email: string;
  squad: string;
  cargo: string;
}

// Map cargo names from CSV to system cargo
function mapCargoFromCSV(cargo: string): UserCargo {
  const normalized = cargo.toLowerCase().trim();
  
  if (normalized === 'coordenador') return 'coordenador';
  if (normalized === 'gerente' || normalized === 'gerente criativa' || normalized === 'gerente de qualidade' || normalized === 'sócio') return 'gerente';
  if (normalized === 'dev full stack' || normalized === 'assistente de tech') return 'tech';
  if (normalized === 'cs/cx' || normalized === 'copywriter') return 'membro';
  
  // Account, Designer, Gestor de tráfego = investidor
  return 'investidor';
}

export function useUserManagement(): UseUserManagementReturn {
  const { user } = useAuth();
  const { isTech, isGerente, isCoordenador, userSquads } = useCargo();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = isTech || isGerente;

  const fetchUsers = useCallback(async () => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('user_management')
        .select(`
          *,
          squads:squad_id (name)
        `)
        .order('full_name', { ascending: true });

      // Coordenadores only see users from their squad
      if (isCoordenador && !isTech && !isGerente) {
        const squadIds = userSquads.map(s => s.id);
        if (squadIds.length > 0) {
          query = query.in('squad_id', squadIds);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } else {
        // Fetch avatar URLs from profiles table
        const userIds = (data || []).map((u: any) => u.user_id).filter(Boolean);
        let avatarMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, avatar_url')
            .in('user_id', userIds);
          
          if (profiles) {
            avatarMap = profiles.reduce((acc: Record<string, string>, p) => {
              if (p.avatar_url) acc[p.user_id] = p.avatar_url;
              return acc;
            }, {});
          }
        }

        const mappedUsers = (data || []).map((u: any) => ({
          ...u,
          squad_name: u.squads?.name || null,
          avatar_url: avatarMap[u.user_id] || null,
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error in useUserManagement:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user, isTech, isGerente, isCoordenador, userSquads]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(async (data: CreateUserData) => {
    if (!user || !canManage) {
      toast.error('Você não tem permissão para criar usuários');
      return;
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('user_management')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();

      if (existingUser) {
        toast.error('Usuário com este email já existe');
        return;
      }

      const { error } = await supabase
        .from('user_management')
        .insert({
          user_id: crypto.randomUUID(), // Placeholder - will be updated when user registers
          email: data.email,
          full_name: data.full_name || null,
          phone: data.phone || null,
          cargo: data.cargo,
          squad_id: data.squad_id || null,
        });

      if (error) throw error;

      toast.success('Usuário criado com sucesso');
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Erro ao criar usuário');
      throw error;
    }
  }, [user, canManage, fetchUsers]);

  const updateUser = useCallback(async (userId: string, data: Partial<CreateUserData>) => {
    if (!user || !canManage) {
      toast.error('Você não tem permissão para atualizar usuários');
      return;
    }

    try {
      const updateData: any = {};
      if (data.email) updateData.email = data.email;
      if (data.full_name !== undefined) updateData.full_name = data.full_name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.cargo) updateData.cargo = data.cargo;
      if (data.squad_id !== undefined) updateData.squad_id = data.squad_id;

      const { error } = await supabase
        .from('user_management')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuário atualizado com sucesso');
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
      throw error;
    }
  }, [user, canManage, fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!user || !isGerente) {
      toast.error('Apenas Gerentes podem excluir usuários');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_management')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuário excluído com sucesso');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário');
      throw error;
    }
  }, [user, isGerente, fetchUsers]);

  const updateUserCargo = useCallback(async (userId: string, cargo: UserCargo) => {
    if (!user || !canManage) {
      toast.error('Você não tem permissão para alterar cargos');
      return;
    }

    try {
      // Update user_management
      const { error: mgmtError } = await supabase
        .from('user_management')
        .update({ cargo })
        .eq('user_id', userId);

      if (mgmtError) throw mgmtError;

      // Also update user_roles if exists
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          cargo,
        }, { onConflict: 'user_id' });

      if (roleError) {
        console.warn('Could not update user_roles:', roleError);
      }

      toast.success('Cargo atualizado com sucesso');
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user cargo:', error);
      toast.error('Erro ao atualizar cargo');
      throw error;
    }
  }, [user, canManage, fetchUsers]);

  const updateUserSquad = useCallback(async (userId: string, squadId: string | null) => {
    if (!user || !canManage) {
      toast.error('Você não tem permissão para trocar squads');
      return;
    }

    try {
      // Update user_management
      const { error: mgmtError } = await supabase
        .from('user_management')
        .update({ squad_id: squadId })
        .eq('user_id', userId);

      if (mgmtError) throw mgmtError;

      // Update squad_members
      // First remove from all squads
      await supabase
        .from('squad_members')
        .delete()
        .eq('user_id', userId);

      // Then add to new squad if provided
      if (squadId) {
        await supabase
          .from('squad_members')
          .insert({ user_id: userId, squad_id: squadId });
      }

      toast.success('Squad atualizada com sucesso');
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user squad:', error);
      toast.error('Erro ao atualizar squad');
      throw error;
    }
  }, [user, canManage, fetchUsers]);

  const importUsersFromCSV = useCallback(async (csvUsers: CSVUserData[]): Promise<{ success: number; failed: number }> => {
    if (!user || !canManage) {
      toast.error('Você não tem permissão para importar usuários');
      return { success: 0, failed: csvUsers.length };
    }

    // First, fetch all squads to map names to IDs
    const { data: squads } = await supabase
      .from('squads')
      .select('id, name');

    const squadMap = new Map<string, string>();
    squads?.forEach(s => {
      squadMap.set(s.name.toUpperCase(), s.id);
    });

    let success = 0;
    let failed = 0;

    for (const csvUser of csvUsers) {
      try {
        const squadName = csvUser.squad?.toUpperCase().trim();
        const squadId = squadMap.get(squadName) || squadMap.get('S/SQUAD') || null;
        const cargo = mapCargoFromCSV(csvUser.cargo);

        // Check if user already exists
        const { data: existing } = await supabase
          .from('user_management')
          .select('id')
          .eq('email', csvUser.email)
          .maybeSingle();

        if (existing) {
          // Update existing user
          await supabase
            .from('user_management')
            .update({
              full_name: csvUser.name,
              phone: csvUser.phone,
              cargo,
              squad_id: squadId,
            })
            .eq('email', csvUser.email);
        } else {
          // Create new user
          await supabase
            .from('user_management')
            .insert({
              user_id: crypto.randomUUID(),
              email: csvUser.email,
              full_name: csvUser.name,
              phone: csvUser.phone,
              cargo,
              squad_id: squadId,
            });
        }

        success++;
      } catch (error) {
        console.error('Error importing user:', csvUser.email, error);
        failed++;
      }
    }

    await fetchUsers();
    return { success, failed };
  }, [user, canManage, fetchUsers]);

  return {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    updateUserCargo,
    updateUserSquad,
    importUsersFromCSV,
    refetch: fetchUsers,
  };
}
