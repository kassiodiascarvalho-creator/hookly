import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RankedProposal {
  proposalId: string;
  rank: number;
  score: number;
  recommendation: string;
  strengths: string[];
  considerations: string[];
  matchReason: string;
}

interface RankingCache {
  rankings: RankedProposal[];
  summary: string;
  topPick?: {
    proposalId: string;
    reason: string;
  };
  generatedAt: string;
  proposalsAnalyzed: number;
}

export interface ProposalRankingData {
  proposalId: string;
  rank: number;
  score: number;
  recommendation: string;
  strengths: string[];
  considerations: string[];
  matchReason: string;
  isTopPick: boolean;
}

export function useProposalRankings(projectId: string | undefined) {
  const [rankings, setRankings] = useState<Map<string, ProposalRankingData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [hasCache, setHasCache] = useState(false);

  const fetchRankings = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const { data: cache, error } = await (supabase as any)
        .from("genius_ranking_cache")
        .select("analysis_result")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching ranking cache:", error);
        setLoading(false);
        return;
      }

      if (cache?.analysis_result) {
        const result = cache.analysis_result as unknown as RankingCache;
        const rankingsMap = new Map<string, ProposalRankingData>();
        
        result.rankings?.forEach((r) => {
          rankingsMap.set(r.proposalId, {
            ...r,
            isTopPick: result.topPick?.proposalId === r.proposalId,
          });
        });

        setRankings(rankingsMap);
        setSummary(result.summary || null);
        setHasCache(true);
      } else {
        setHasCache(false);
      }
    } catch (err) {
      console.error("Failed to fetch rankings:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const getRankingForProposal = (proposalId: string): ProposalRankingData | null => {
    return rankings.get(proposalId) || null;
  };

  const sortProposalsByScore = <T extends { id: string; created_at: string }>(
    proposals: T[]
  ): T[] => {
    if (!hasCache || rankings.size === 0) {
      return proposals;
    }

    return [...proposals].sort((a, b) => {
      const rankingA = rankings.get(a.id);
      const rankingB = rankings.get(b.id);

      // Proposals with rankings come first, sorted by score (desc)
      if (rankingA && rankingB) {
        return rankingB.score - rankingA.score;
      }
      if (rankingA) return -1;
      if (rankingB) return 1;

      // Fallback to created_at
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  return {
    rankings,
    loading,
    summary,
    hasCache,
    getRankingForProposal,
    sortProposalsByScore,
    refetch: fetchRankings,
  };
}
