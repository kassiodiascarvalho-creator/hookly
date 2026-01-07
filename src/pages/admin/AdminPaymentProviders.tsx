import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Copy,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface MpConfig {
  public_key?: string;
  [key: string]: unknown;
}

interface PaymentProvider {
  id: string;
  provider: string;
  is_enabled: boolean;
  is_sandbox: boolean;
  webhook_url: string | null;
  last_tested_at: string | null;
  test_status: string | null;
  config_encrypted: MpConfig | null;
}

export default function AdminPaymentProviders() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [mpPublicKey, setMpPublicKey] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    const { data, error } = await supabase
      .from("payment_providers")
      .select("*")
      .order("provider");

    if (error) {
      console.error("Error fetching providers:", error);
      toast.error("Erro ao carregar provedores");
    } else if (data) {
      const typedData = data as unknown as PaymentProvider[];
      setProviders(typedData);
      // Set MP public key from config
      const mp = typedData.find(p => p.provider === "mercadopago");
      if (mp?.config_encrypted?.public_key) {
        setMpPublicKey(mp.config_encrypted.public_key);
      }
    }
    setLoading(false);
  };

  const updateProvider = async (id: string, updates: { is_enabled?: boolean; is_sandbox?: boolean }) => {
    setSaving(true);
    const { error } = await supabase
      .from("payment_providers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error updating provider:", error);
      toast.error("Erro ao atualizar provedor");
    } else {
      toast.success("Provedor atualizado");
      fetchProviders();
    }
    setSaving(false);
  };

  const saveMpPublicKey = async () => {
    const mp = providers.find(p => p.provider === "mercadopago");
    if (!mp) return;

    setSaving(true);
    const newConfig = { ...(mp.config_encrypted || {}), public_key: mpPublicKey };
    
    const { error } = await supabase
      .from("payment_providers")
      .update({ 
        config_encrypted: newConfig as Json, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", mp.id);

    if (error) {
      console.error("Error saving public key:", error);
      toast.error("Erro ao salvar Public Key");
    } else {
      toast.success("Public Key salva com sucesso");
      fetchProviders();
    }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getWebhookUrl = (provider: string) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (provider === "mercadopago") {
      return `${baseUrl}/functions/v1/mp-webhook`;
    }
    return `${baseUrl}/functions/v1/unified-webhook`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stripeProvider = providers.find(p => p.provider === "stripe");
  const mpProvider = providers.find(p => p.provider === "mercadopago");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Provedores de Pagamento</h1>
        <p className="text-muted-foreground">
          Configure as integrações de pagamento da plataforma
        </p>
      </div>

      {/* Stripe Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#635bff]/10">
                <CreditCard className="h-6 w-6 text-[#635bff]" />
              </div>
              <div>
                <CardTitle>Stripe</CardTitle>
                <CardDescription>Pagamentos internacionais via cartão</CardDescription>
              </div>
            </div>
            <Badge variant={stripeProvider?.is_enabled ? "default" : "secondary"}>
              {stripeProvider?.is_enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Status</Label>
              <p className="text-sm text-muted-foreground">
                Stripe está configurado via variáveis de ambiente
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-600">Configurado</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input 
                value={getWebhookUrl("stripe")} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(getWebhookUrl("stripe"))}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure este URL no Dashboard do Stripe em Developers → Webhooks
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Habilitado</Label>
            <Switch
              checked={stripeProvider?.is_enabled ?? true}
              onCheckedChange={(checked) => 
                stripeProvider && updateProvider(stripeProvider.id, { is_enabled: checked })
              }
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mercado Pago Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#009ee3]/10">
                <CreditCard className="h-6 w-6 text-[#009ee3]" />
              </div>
              <div>
                <CardTitle>Mercado Pago</CardTitle>
                <CardDescription>Pagamentos no Brasil via PIX e cartão</CardDescription>
              </div>
            </div>
            <Badge variant={mpProvider?.is_enabled ? "default" : "secondary"}>
              {mpProvider?.is_enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Configuração Necessária</p>
                <p className="text-muted-foreground mt-1">
                  O Access Token do Mercado Pago deve ser configurado nas variáveis de ambiente 
                  do projeto (MERCADOPAGO_ACCESS_TOKEN).
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Modo Sandbox</Label>
                <p className="text-xs text-muted-foreground">
                  Use o ambiente de testes do Mercado Pago
                </p>
              </div>
              <Switch
                checked={mpProvider?.is_sandbox ?? true}
                onCheckedChange={(checked) => 
                  mpProvider && updateProvider(mpProvider.id, { is_sandbox: checked })
                }
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Public Key (Frontend)</Label>
              <div className="flex gap-2">
                <Input 
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  placeholder="APP_USR-..."
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={saveMpPublicKey}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A Public Key é usada no frontend para inicializar o Mercado Pago Bricks (checkout transparente)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Webhook URL (IPN)</Label>
              <div className="flex gap-2">
                <Input 
                  value={getWebhookUrl("mercadopago")} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(getWebhookUrl("mercadopago"))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure este URL no painel do Mercado Pago em Integrações → Notificações
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch
                checked={mpProvider?.is_enabled ?? false}
                onCheckedChange={(checked) => 
                  mpProvider && updateProvider(mpProvider.id, { is_enabled: checked })
                }
                disabled={saving}
              />
            </div>
          </div>

          <Separator />

          {/* Setup Instructions */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Como configurar</Label>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Acesse o{" "}
                <a 
                  href="https://www.mercadopago.com.br/developers/panel/app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Painel de Desenvolvedores do Mercado Pago
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Crie uma aplicação ou selecione uma existente</li>
              <li>Copie o <strong>Access Token</strong> (Produção ou Teste)</li>
              <li>Configure o Access Token nas variáveis de ambiente do projeto</li>
              <li>Configure a URL de Webhook (IPN) no painel do Mercado Pago</li>
              <li>Ative a integração usando o toggle acima</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Payment Routing Info */}
      <Card>
        <CardHeader>
          <CardTitle>Roteamento de Pagamentos</CardTitle>
          <CardDescription>
            Como os pagamentos são direcionados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Badge>Brasil (BR)</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Usuários com país definido como Brasil serão direcionados para o Mercado Pago 
                (se habilitado), com opções de PIX e cartão de crédito.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">Outros países</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Usuários de outros países ou sem país definido serão direcionados para o Stripe, 
                com pagamento via cartão de crédito internacional.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
