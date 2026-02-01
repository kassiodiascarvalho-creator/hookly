import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Zap, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlatformCredits } from "@/hooks/usePlatformCredits";

interface QueueItem {
  proposal_id: string;
  freelancer_user_id: string;
  freelancer_name: string | null;
  freelancer_avatar: string | null;
  boost_credits: number;
  queue_position: number;
  is_current_user: boolean;
  created_at: string;
}

interface ProposalQueueCardProps {
  projectId: string;
  myProposalId?: string | null;
  onBoostSuccess?: () => void;
}

export function ProposalQueueCard({ projectId, myProposalId, onBoostSuccess }: ProposalQueueCardProps) {
  const { t } = useTranslation();
  const { balance: creditBalance, refreshBalance } = usePlatformCredits();
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [boostAmount, setBoostAmount] = useState<number>(2);
  const [showBoostInput, setShowBoostInput] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, [projectId]);

  const fetchQueue = async () => {
    setLoading(true);
    
    // Use the RPC function to get the queue
    const { data, error } = await supabase.rpc('get_proposal_queue', {
      p_project_id: projectId
    });

    if (error) {
      console.error("Error fetching queue:", error);
      setLoading(false);
      return;
    }

    // Transform the data to our interface
    const transformed: QueueItem[] = (data || []).map((item: {
      proposal_id: string;
      freelancer_user_id: string;
      freelancer_name: string | null;
      freelancer_avatar: string | null;
      boost_credits: number;
      queue_position: number;
      is_current_user: boolean;
      created_at: string;
    }) => ({
      proposal_id: item.proposal_id,
      freelancer_user_id: item.freelancer_user_id,
      freelancer_name: item.freelancer_name,
      freelancer_avatar: item.freelancer_avatar,
      boost_credits: item.boost_credits || 0,
      queue_position: item.queue_position,
      is_current_user: item.is_current_user,
      created_at: item.created_at,
    }));

    setQueue(transformed);
    setLoading(false);
  };

  const myPosition = queue.find(q => q.is_current_user)?.queue_position || null;
  const topBoost = queue.length > 0 ? Math.max(...queue.map(q => q.boost_credits)) : 0;
  const minToPassFirst = topBoost > 0 ? topBoost + 1 : 2;

  const handleBoost = async () => {
    if (!myProposalId) {
      toast.error("Você precisa enviar uma proposta primeiro");
      return;
    }

    if (boostAmount < 2) {
      toast.error("Mínimo de 2 créditos para boost");
      return;
    }

    if (creditBalance < boostAmount) {
      toast.error(`Saldo insuficiente. Você tem ${creditBalance} crédito(s)`);
      return;
    }

    setBoosting(true);
    
    // Call boost RPC
    const { data: result, error } = await supabase.rpc('boost_proposal', {
      p_proposal_id: myProposalId,
      p_boost_amount: boostAmount
    });

    if (error) {
      console.error("Boost error:", error);
      toast.error("Erro ao impulsionar proposta");
      setBoosting(false);
      return;
    }

    // Cast result to expected shape
    const typedResult = result as { success: boolean; new_boost_total?: number; error?: string } | null;

    if (typedResult && typedResult.success) {
      toast.success(`Proposta impulsionada! Total de boost: ${typedResult.new_boost_total} créditos`);
      await fetchQueue();
      await refreshBalance();
      setShowBoostInput(false);
      onBoostSuccess?.();
    } else {
      toast.error(typedResult?.error || "Erro ao impulsionar proposta");
    }

    setBoosting(false);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (queue.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fila de Propostas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma proposta enviada ainda. Seja o primeiro!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Fila de Propostas ({queue.length})
        </CardTitle>
        <CardDescription>
          Quem tem mais créditos de boost aparece primeiro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current position indicator */}
        {myPosition && (
          <div className={cn(
            "p-3 rounded-lg border-2",
            myPosition === 1 ? "border-primary bg-primary/10" : "border-muted bg-muted/30"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {myPosition === 1 ? (
                  <Crown className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {myPosition === 1 ? "Você está em 1º lugar!" : `Sua posição: ${myPosition}º`}
                </span>
              </div>
              {myPosition > 1 && (
                <Badge variant="secondary">
                  {minToPassFirst} crédito(s) para o 1º
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Queue list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {queue.map((item) => (
            <div
              key={item.proposal_id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                item.is_current_user ? "bg-primary/10 border border-primary/30" : "bg-muted/30",
                item.queue_position === 1 && "ring-2 ring-primary/50"
              )}
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                {item.queue_position === 1 ? (
                  <Crown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  item.queue_position
                )}
              </div>
              
              <Avatar className="h-8 w-8">
                <AvatarImage src={item.freelancer_avatar || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(item.freelancer_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  item.is_current_user && "text-primary"
                )}>
                  {item.freelancer_name || "Freelancer"}
                  {item.is_current_user && " (você)"}
                </p>
              </div>
              
              {/* Always show boost credits badge */}
              <Badge variant={item.boost_credits > 0 ? "default" : "outline"} className="gap-1 shrink-0">
                <Zap className="h-3 w-3" />
                {item.boost_credits}
              </Badge>
            </div>
          ))}
        </div>

        {/* Boost section */}
        {myProposalId && myPosition && myPosition > 1 && (
          <div className="pt-3 border-t space-y-3">
            {!showBoostInput ? (
              <Button 
                onClick={() => setShowBoostInput(true)} 
                className="w-full gap-2"
                variant="outline"
              >
                <Zap className="h-4 w-4" />
                Impulsionar Proposta
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={2}
                    value={boostAmount}
                    onChange={(e) => setBoostAmount(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">crédito(s)</span>
                  <Button
                    onClick={handleBoost}
                    disabled={boosting || boostAmount > creditBalance}
                    className="gap-2"
                  >
                    {boosting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Boost
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Seu saldo: {creditBalance} crédito(s) • Mínimo: 2 • Para 1º lugar: {minToPassFirst}
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowBoostInput(false)}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Already in first place */}
        {myPosition === 1 && (
          <div className="pt-3 border-t">
            <p className="text-sm text-center text-muted-foreground">
              🏆 Você está no topo da fila!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
