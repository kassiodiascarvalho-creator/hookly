import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface PublishResult {
  success: boolean;
  error?: string;
  completion_percent?: number;
}

interface UsePublishProjectReturn {
  publishProject: (projectId: string) => Promise<PublishResult>;
  isPublishing: boolean;
}

export function usePublishProject(): UsePublishProjectReturn {
  const { t } = useTranslation();
  const [isPublishing, setIsPublishing] = useState(false);

  const publishProject = useCallback(async (projectId: string): Promise<PublishResult> => {
    setIsPublishing(true);
    
    try {
      const { data, error } = await supabase.rpc('publish_project' as any, {
        p_project_id: projectId
      });

      if (error) {
        console.error('[usePublishProject] RPC error:', error);
        
        // Check if error message contains profile incomplete info
        if (error.message?.includes('COMPANY_PROFILE_INCOMPLETE') || 
            error.code === 'P0001') {
          // Don't show generic toast - let caller handle with modal
          return { success: false, error: 'COMPANY_PROFILE_INCOMPLETE' };
        }
        
        toast.error(t('common.error'));
        return { success: false, error: 'RPC_ERROR' };
      }

      const result = data as unknown as PublishResult;
      
      if (!result?.success) {
        // Handle specific errors
        if (result?.error === 'COMPANY_PROFILE_INCOMPLETE') {
          // Don't show toast here - let the caller handle it
          return { 
            success: false, 
            error: 'COMPANY_PROFILE_INCOMPLETE',
            completion_percent: result.completion_percent
          };
        }
        
        if (result?.error === 'PROJECT_NOT_DRAFT') {
          toast.info(t('projects.alreadyPublished'));
          return { success: false, error: 'PROJECT_NOT_DRAFT' };
        }

        if (result?.error === 'UNAUTHORIZED') {
          toast.error(t('common.unauthorized'));
          return { success: false, error: 'UNAUTHORIZED' };
        }

        if (result?.error === 'PROJECT_NOT_FOUND') {
          toast.error(t('projects.notFound'));
          return { success: false, error: 'PROJECT_NOT_FOUND' };
        }

        toast.error(t('common.error'));
        return { success: false, error: result?.error || 'UNKNOWN_ERROR' };
      }

      toast.success(t('projects.published'));
      return { success: true };
      
    } catch (err) {
      console.error('[usePublishProject] Error:', err);
      toast.error(t('common.error'));
      return { success: false, error: 'EXCEPTION' };
    } finally {
      setIsPublishing(false);
    }
  }, [t]);

  return {
    publishProject,
    isPublishing
  };
}
