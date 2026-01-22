import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Wand2, Loader2, Copy, Check, Clock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeniusAccess } from "@/hooks/useGeniusAccess";
import { GeniusPurchaseModal } from "./GeniusPurchaseModal";
import { toast } from "sonner";

interface GeniusProposalButtonProps {
  projectId: string;
  onProposalGenerated?: (proposal: string) => void;
  disabled?: boolean;
}

const tones = [
  { value: "professional", label: "Profissional" },
  { value: "creative", label: "Criativo" },
  { value: "direct", label: "Direto" },
  { value: "technical", label: "Técnico" },
  { value: "friendly", label: "Amigável" },
];

export function GeniusProposalButton({
  projectId,
  onProposalGenerated,
  disabled,
}: GeniusProposalButtonProps) {
  const { t, i18n } = useTranslation();
  const { hasAccess, source, daysRemaining, loading: accessLoading, refetch } = useGeniusAccess("proposal_ai");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState("professional");

  const handleGenerate = async () => {
    if (!hasAccess) {
      setPurchaseModalOpen(true);
      return;
    }

    setModalOpen(true);
  };

  const generateProposal = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("genius-proposal", {
        body: {
          projectId,
          tone,
          language: i18n.language || "pt",
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.requiresUpgrade) {
          setPurchaseModalOpen(true);
          setModalOpen(false);
          return;
        }
        throw new Error(data.error);
      }

      setGeneratedProposal(data.proposal);
    } catch (error) {
      console.error("Failed to generate proposal:", error);
      toast.error(t("genius.generationError", "Erro ao gerar proposta"));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedProposal) {
      navigator.clipboard.writeText(generatedProposal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("genius.copiedToClipboard", "Copiado para a área de transferência"));
    }
  };

  const handleUse = () => {
    if (generatedProposal && onProposalGenerated) {
      onProposalGenerated(generatedProposal);
      setModalOpen(false);
      setGeneratedProposal(null);
      toast.success(t("genius.proposalApplied", "Proposta aplicada"));
    }
  };

  const handlePurchaseSuccess = () => {
    refetch();
    setPurchaseModalOpen(false);
    setModalOpen(true);
  };

  return (
    <>
      <Button
        variant={hasAccess ? "default" : "outline"}
        onClick={handleGenerate}
        disabled={disabled || accessLoading}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {t("genius.generateWithAI", "Gerar com IA")}
        {hasAccess && source === "credits" && daysRemaining && (
          <Badge variant="secondary" className="ml-1 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {daysRemaining}d
          </Badge>
        )}
        {hasAccess && source === "plan" && (
          <Crown className="h-3 w-3 ml-1 text-yellow-500" />
        )}
      </Button>

      {/* Generation Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) {
          setGeneratedProposal(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Hookly Genius
            </DialogTitle>
            <DialogDescription>
              {t("genius.proposalDescription", "Gere uma proposta personalizada baseada no seu perfil real")}
            </DialogDescription>
          </DialogHeader>

          {!generatedProposal ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("genius.selectTone", "Tom da proposta")}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium text-sm mb-2">
                  {t("genius.whatWeUse", "O que usamos para criar sua proposta:")}
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t("genius.useProfile", "Seu perfil completo (habilidades, bio, experiência)")}</li>
                  <li>• {t("genius.useCertifications", "Suas certificações verificadas")}</li>
                  <li>• {t("genius.usePortfolio", "Seus trabalhos no portfólio")}</li>
                  <li>• {t("genius.useProjectBrief", "O briefing do projeto")}</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ {t("genius.honestWarning", "A IA nunca inventa qualificações. Apenas usa informações reais do seu perfil.")}
                </p>
              </div>

              <Button
                onClick={generateProposal}
                disabled={generating}
                className="w-full gap-2"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("genius.generating", "Gerando proposta...")}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    {t("genius.generateProposal", "Gerar Proposta")}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="relative">
                <Textarea
                  value={generatedProposal}
                  onChange={(e) => setGeneratedProposal(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="absolute top-2 right-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setGeneratedProposal(null)}
                  className="flex-1"
                >
                  {t("genius.regenerate", "Gerar Outra")}
                </Button>
                <Button
                  onClick={handleUse}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  {t("genius.useProposal", "Usar Esta Proposta")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase Modal */}
      <GeniusPurchaseModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        featureType="proposal_ai"
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}
