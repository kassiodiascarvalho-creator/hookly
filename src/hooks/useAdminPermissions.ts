import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminPermissions {
  id: string;
  user_id: string;
  is_owner: boolean;
  can_manage_users: boolean;
  can_manage_freelancers: boolean;
  can_manage_companies: boolean;
  can_manage_projects: boolean;
  can_manage_payments: boolean;
  can_manage_finances: boolean;
  can_manage_tiers: boolean;
  can_manage_payment_providers: boolean;
  can_manage_landing_page: boolean;
  can_manage_tracking_pixels: boolean;
  can_manage_admins: boolean;
  can_manage_analytics: boolean;
  can_manage_identity: boolean;
  can_manage_feedbacks: boolean;
  added_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminWithProfile extends AdminPermissions {
  email: string;
  full_name?: string;
}

export function useAdminPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions(null);
        setIsOwner(false);
        setLoading(false);
        return;
      }

      try {
        // Use raw query to bypass type issues with new table
        const { data, error } = await supabase
          .from("admin_permissions" as any)
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching admin permissions:", error);
          setPermissions(null);
          setIsOwner(false);
        } else if (data) {
          const typedData = data as unknown as AdminPermissions;
          setPermissions(typedData);
          setIsOwner(typedData.is_owner === true);
        } else {
          setPermissions(null);
          setIsOwner(false);
        }
      } catch (err) {
        console.error("Error in permission check:", err);
        setPermissions(null);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (permission: keyof AdminPermissions): boolean => {
    if (isOwner) return true;
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  return { permissions, isOwner, loading, hasPermission };
}

export function useAllAdmins() {
  const [admins, setAdmins] = useState<AdminWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      // Fetch all admin permissions using raw query
      const { data: permissionsData, error: permError } = await supabase
        .from("admin_permissions" as any)
        .select("*")
        .order("is_owner", { ascending: false })
        .order("created_at", { ascending: true });

      if (permError) throw permError;

      const typedPermissions = (permissionsData || []) as unknown as AdminPermissions[];

      if (typedPermissions.length === 0) {
        setAdmins([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all admins
      const userIds = typedPermissions.map((p) => p.user_id);
      const { data: profilesData, error: profError } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);

      if (profError) throw profError;

      // Fetch freelancer names
      const { data: freelancerData } = await supabase
        .from("freelancer_profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Fetch company names
      const { data: companyData } = await supabase
        .from("company_profiles")
        .select("user_id, contact_name, company_name")
        .in("user_id", userIds);

      // Merge data
      const adminsWithProfiles: AdminWithProfile[] = typedPermissions.map((perm) => {
        const profile = profilesData?.find((p) => p.user_id === perm.user_id);
        const freelancer = freelancerData?.find((f) => f.user_id === perm.user_id);
        const company = companyData?.find((c) => c.user_id === perm.user_id);

        return {
          ...perm,
          email: profile?.email || "Unknown",
          full_name: freelancer?.full_name || company?.contact_name || company?.company_name,
        };
      });

      setAdmins(adminsWithProfiles);
    } catch (err) {
      console.error("Error fetching admins:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  return { admins, loading, error, refetch: fetchAdmins };
}

export function useAdminActions() {
  const [loading, setLoading] = useState(false);

  const addSubAdmin = async (
    email: string,
    permissions: Partial<AdminPermissions>
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("add_sub_admin" as any, {
        p_email: email,
        p_permissions: permissions,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string };
      return result;
    } catch (err) {
      console.error("Error adding sub-admin:", err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  };

  const removeSubAdmin = async (
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("remove_sub_admin" as any, {
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string };
      return result;
    } catch (err) {
      console.error("Error removing sub-admin:", err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  };

  const updateSubAdminPermissions = async (
    userId: string,
    permissions: Partial<AdminPermissions>
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("update_sub_admin_permissions" as any, {
        p_user_id: userId,
        p_permissions: permissions,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string };
      return result;
    } catch (err) {
      console.error("Error updating sub-admin permissions:", err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  };

  return { addSubAdmin, removeSubAdmin, updateSubAdminPermissions, loading };
}
