import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LandingSection {
  id: string;
  section_key: string;
  section_order: number;
  is_visible: boolean;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown>;
  background_image_url: string | null;
  background_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingFaqItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingStat {
  id: string;
  label: string;
  value: string;
  icon: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingSocialLink {
  id: string;
  platform: string;
  url: string | null;
  icon: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export function useLandingSections() {
  return useQuery({
    queryKey: ["landing-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_sections" as any)
        .select("*")
        .order("section_order", { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as LandingSection[];
    },
  });
}

export function useLandingFaqItems() {
  return useQuery({
    queryKey: ["landing-faq-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_faq_items" as any)
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as LandingFaqItem[];
    },
  });
}

export function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_stats" as any)
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as LandingStat[];
    },
  });
}

export function useUpdateLandingSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingSection> & { id: string }) => {
      const { data, error } = await supabase
        .from("landing_sections" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-sections"] });
      toast.success("Seção atualizada com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating section:", error);
      toast.error("Erro ao atualizar seção");
    },
  });
}

export function useUpdateLandingFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingFaqItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("landing_faq_items" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-faq-items"] });
      toast.success("FAQ atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating FAQ:", error);
      toast.error("Erro ao atualizar FAQ");
    },
  });
}

export function useCreateLandingFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (faq: Omit<LandingFaqItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("landing_faq_items" as any)
        .insert(faq as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-faq-items"] });
      toast.success("FAQ criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating FAQ:", error);
      toast.error("Erro ao criar FAQ");
    },
  });
}

export function useDeleteLandingFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_faq_items" as any)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-faq-items"] });
      toast.success("FAQ removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting FAQ:", error);
      toast.error("Erro ao remover FAQ");
    },
  });
}

export function useUpdateLandingStat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingStat> & { id: string }) => {
      const { data, error } = await supabase
        .from("landing_stats" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-stats"] });
      toast.success("Estatística atualizada com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating stat:", error);
      toast.error("Erro ao atualizar estatística");
    },
  });
}

export function useCreateLandingStat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stat: Omit<LandingStat, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("landing_stats" as any)
        .insert(stat as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-stats"] });
      toast.success("Estatística criada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating stat:", error);
      toast.error("Erro ao criar estatística");
    },
  });
}

export function useDeleteLandingStat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_stats" as any)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-stats"] });
      toast.success("Estatística removida com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting stat:", error);
      toast.error("Erro ao remover estatística");
    },
  });
}

// Social Links hooks
export function useLandingSocialLinks() {
  return useQuery({
    queryKey: ["landing-social-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_social_links" as any)
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as LandingSocialLink[];
    },
  });
}

export function useUpdateLandingSocialLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LandingSocialLink> & { id: string }) => {
      const { data, error } = await supabase
        .from("landing_social_links" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-social-links"] });
      toast.success("Rede social atualizada com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating social link:", error);
      toast.error("Erro ao atualizar rede social");
    },
  });
}

export function useCreateLandingSocialLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (link: Omit<LandingSocialLink, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("landing_social_links" as any)
        .insert(link as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-social-links"] });
      toast.success("Rede social criada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating social link:", error);
      toast.error("Erro ao criar rede social");
    },
  });
}

export function useDeleteLandingSocialLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_social_links" as any)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-social-links"] });
      toast.success("Rede social removida com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting social link:", error);
      toast.error("Erro ao remover rede social");
    },
  });
}
