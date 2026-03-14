import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Type definitions
interface ContractPending {
  id: string;
  title: string;
  contractTotal: number; // major units
  protectedCurrent: number; // major units
  missing: number; // major units
  currency: string;
  freelancerName: string | null;
  freelancerUserId: string;
}

interface ProjectUnfunded {
  id: string;
  title: string;
  budgetMax: number; // major units
  currency: string;
}

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface PendingCommitments {
  byCurrency: CurrencyAmount[];
  contracts: ContractPending[];
  totalContracts: number;
}

interface UnfundedPotential {
  byCurrency: CurrencyAmount[];
  projects: ProjectUnfunded[];
  totalProjects: number;
}

export interface CompanyFinancialSummary {
  pendingCommitments: PendingCommitments;
  unfundedPotential: UnfundedPotential;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useCompanyFinancialSummary(): CompanyFinancialSummary {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingCommitments, setPendingCommitments] = useState<PendingCommitments>({
    byCurrency: [],
    contracts: [],
    totalContracts: 0,
  });
  const [unfundedPotential, setUnfundedPotential] = useState<UnfundedPotential>({
    byCurrency: [],
    projects: [],
    totalProjects: 0,
  });

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch active contracts for the company
      const { data: contracts, error: contractsError } = await (supabase as any)
        .from("contracts")
        .select(`
          id,
          title,
          amount_cents,
          currency,
          milestones,
          freelancer_user_id
        `)
        .eq("company_user_id", user.id)
        .in("status", ["active", "in_progress"]);

      if (contractsError) {
        console.error("[useCompanyFinancialSummary] Error fetching contracts:", contractsError);
      }

      // 1b. Fetch freelancer profiles for contracts
      const freelancerIds = [...new Set(contracts?.map((c) => c.freelancer_user_id).filter(Boolean) || [])];
      let freelancerNames: Record<string, string> = {};

      if (freelancerIds.length > 0) {
        const { data: freelancers } = await supabase
          .from("freelancer_profiles")
          .select("user_id, full_name")
          .in("user_id", freelancerIds);

        freelancers?.forEach((f) => {
          if (f.user_id && f.full_name) {
            freelancerNames[f.user_id] = f.full_name;
          }
        });
      }

      // 2. Fetch ledger transactions for contract funding/release
      const contractIds = contracts?.map((c) => c.id) || [];
      
      let fundingByContract: Record<string, number> = {};
      let releasedByContract: Record<string, number> = {};

      if (contractIds.length > 0) {
        const { data: ledgerData, error: ledgerError } = await (supabase as any)
          .from("ledger_transactions")
          .select("tx_type, amount, related_contract_id")
          .in("related_contract_id", contractIds)
          .in("tx_type", ["contract_funding", "escrow_release"]);

        if (ledgerError) {
          console.error("[useCompanyFinancialSummary] Error fetching ledger:", ledgerError);
        }

        // Aggregate by contract
        ledgerData?.forEach((tx) => {
          const contractId = tx.related_contract_id;
          if (!contractId) return;
          
          const amount = Math.abs(Number(tx.amount) || 0);
          
          if (tx.tx_type === "contract_funding") {
            fundingByContract[contractId] = (fundingByContract[contractId] || 0) + amount;
          } else if (tx.tx_type === "escrow_release") {
            // escrow_release has negative amount for company
            releasedByContract[contractId] = (releasedByContract[contractId] || 0) + amount;
          }
        });
      }

      // 3. Calculate pending commitments
      const pendingContracts: ContractPending[] = [];
      const currencyTotals: Record<string, number> = {};

      contracts?.forEach((contract) => {
        // Contract total from amount_cents (in cents)
        const contractTotalMajor = (contract.amount_cents || 0) / 100;
        
        // Calculate protected current = funded - released
        const funded = fundingByContract[contract.id] || 0;
        const released = releasedByContract[contract.id] || 0;
        const protectedCurrent = Math.max(0, funded - released);
        
        // Missing = what's left to fund
        const missing = Math.max(0, contractTotalMajor - protectedCurrent);
        
        if (missing > 0) {
          pendingContracts.push({
            id: contract.id,
            title: contract.title,
            contractTotal: contractTotalMajor,
            protectedCurrent,
            missing,
            currency: contract.currency,
            freelancerName: freelancerNames[contract.freelancer_user_id] || null,
            freelancerUserId: contract.freelancer_user_id,
          });

          // Aggregate by currency
          if (!currencyTotals[contract.currency]) {
            currencyTotals[contract.currency] = 0;
          }
          currencyTotals[contract.currency] += missing;
        }
      });

      setPendingCommitments({
        byCurrency: Object.entries(currencyTotals).map(([currency, amount]) => ({
          currency,
          amount,
        })),
        contracts: pendingContracts,
        totalContracts: pendingContracts.length,
      });

      // 4. Fetch open projects without active contracts
      const { data: openProjects, error: projectsError } = await (supabase as any)
        .from("projects")
        .select("id, title, budget_max, currency")
        .eq("company_user_id", user.id)
        .eq("status", "open");

      if (projectsError) {
        console.error("[useCompanyFinancialSummary] Error fetching projects:", projectsError);
      }

      // 5. Check which projects have active contracts
      const projectIds = openProjects?.map((p) => p.id) || [];
      let projectsWithContracts: Set<string> = new Set();

      if (projectIds.length > 0) {
        const { data: projectContracts } = await (supabase as any)
          .from("contracts")
          .select("project_id")
          .in("project_id", projectIds)
          .in("status", ["active", "in_progress", "draft"]);

        projectContracts?.forEach((c) => {
          if (c.project_id) projectsWithContracts.add(c.project_id);
        });
      }

      // 6. Check which projects have prefund payments
      let projectsWithPrefund: Set<string> = new Set();

      if (projectIds.length > 0) {
        const { data: prefundPayments } = await (supabase as any)
          .from("unified_payments")
          .select("metadata")
          .eq("payment_type", "project_prefund")
          .eq("status", "paid");

        prefundPayments?.forEach((p) => {
          const projectId = (p.metadata as any)?.project_id;
          if (projectId && projectIds.includes(projectId)) {
            projectsWithPrefund.add(projectId);
          }
        });
      }

      // 7. Filter projects: open, no active contract, no prefund
      const unfundedProjects: ProjectUnfunded[] = [];
      const unfundedCurrencyTotals: Record<string, number> = {};

      openProjects?.forEach((project) => {
        // Skip if has active contract or prefund
        if (projectsWithContracts.has(project.id)) return;
        if (projectsWithPrefund.has(project.id)) return;

        const budgetMax = Number(project.budget_max) || 0;
        if (budgetMax <= 0) return;

        unfundedProjects.push({
          id: project.id,
          title: project.title,
          budgetMax,
          currency: project.currency,
        });

        if (!unfundedCurrencyTotals[project.currency]) {
          unfundedCurrencyTotals[project.currency] = 0;
        }
        unfundedCurrencyTotals[project.currency] += budgetMax;
      });

      setUnfundedPotential({
        byCurrency: Object.entries(unfundedCurrencyTotals).map(([currency, amount]) => ({
          currency,
          amount,
        })),
        projects: unfundedProjects,
        totalProjects: unfundedProjects.length,
      });

    } catch (error) {
      console.error("[useCompanyFinancialSummary] Error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    pendingCommitments,
    unfundedPotential,
    loading,
    refetch: fetchData,
  };
}
