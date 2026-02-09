import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Facebook, BarChart3, Code } from "lucide-react";

interface TrackingPixel {
  id?: string;
  pixel_type: string;
  pixel_id: string;
  is_active: boolean;
}

const PIXEL_TYPES = [
  { 
    type: "facebook_pixel", 
    label: "Facebook Pixel", 
    icon: Facebook,
    placeholder: "Ex: 1234567890123456",
    description: "Cole o ID do seu Facebook Pixel para rastrear conversões e criar públicos"
  },
  { 
    type: "google_analytics", 
    label: "Google Analytics 4", 
    icon: BarChart3,
    placeholder: "Ex: G-XXXXXXXXXX",
    description: "Cole o Measurement ID do seu Google Analytics 4"
  },
  { 
    type: "google_tag_manager", 
    label: "Google Tag Manager", 
    icon: Code,
    placeholder: "Ex: GTM-XXXXXXX",
    description: "Cole o Container ID do seu Google Tag Manager"
  },
];

export default function AdminTrackingPixels() {
  const { t } = useTranslation();
  const [pixels, setPixels] = useState<Record<string, TrackingPixel>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchPixels();
  }, []);

  const fetchPixels = async () => {
    try {
      const { data, error } = await supabase
        .from("tracking_pixels" as any)
        .select("*");

      if (error) throw error;

      const pixelMap: Record<string, TrackingPixel> = {};
      (data || []).forEach((pixel: any) => {
        pixelMap[pixel.pixel_type] = pixel;
      });

      // Initialize empty pixels for types that don't exist
      PIXEL_TYPES.forEach(({ type }) => {
        if (!pixelMap[type]) {
          pixelMap[type] = {
            pixel_type: type,
            pixel_id: "",
            is_active: false,
          };
        }
      });

      setPixels(pixelMap);
    } catch (error) {
      console.error("Error fetching pixels:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de pixels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePixelChange = (type: string, field: "pixel_id" | "is_active", value: string | boolean) => {
    setPixels(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const handleSave = async (type: string) => {
    const pixel = pixels[type];
    if (!pixel) return;

    setSaving(type);

    try {
      if (pixel.id) {
        // Update existing
        const { error } = await supabase
          .from("tracking_pixels" as any)
          .update({
            pixel_id: pixel.pixel_id,
            is_active: pixel.is_active,
          })
          .eq("id", pixel.id);

        if (error) throw error;
      } else if (pixel.pixel_id.trim()) {
        // Insert new
        const { data, error } = await supabase
          .from("tracking_pixels" as any)
          .insert({
            pixel_type: type,
            pixel_id: pixel.pixel_id,
            is_active: pixel.is_active,
          })
          .select()
          .single();

        if (error) throw error;

        // Update local state with new ID
        setPixels(prev => ({
          ...prev,
          [type]: { ...prev[type], id: (data as any).id },
        }));
      }

      toast({
        title: "Sucesso",
        description: "Configuração salva com sucesso!",
      });
    } catch (error) {
      console.error("Error saving pixel:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (type: string) => {
    const pixel = pixels[type];
    if (!pixel?.id) return;

    setSaving(type);

    try {
      const { error } = await supabase
        .from("tracking_pixels" as any)
        .delete()
        .eq("id", pixel.id);

      if (error) throw error;

      setPixels(prev => ({
        ...prev,
        [type]: {
          pixel_type: type,
          pixel_id: "",
          is_active: false,
        },
      }));

      toast({
        title: "Sucesso",
        description: "Pixel removido com sucesso!",
      });
    } catch (error) {
      console.error("Error deleting pixel:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o pixel",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pixels de Rastreamento</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Pixels de Rastreamento</h1>
        <p className="text-muted-foreground">
          Configure os pixels do Facebook e Google para rastrear conversões e analisar o comportamento dos usuários
        </p>
      </div>

      <div className="grid gap-6">
        {PIXEL_TYPES.map(({ type, label, icon: Icon, placeholder, description }) => {
          const pixel = pixels[type];
          const isSaving = saving === type;

          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{label}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${type}-active`} className="text-sm text-muted-foreground">
                      {pixel?.is_active ? "Ativo" : "Inativo"}
                    </Label>
                    <Switch
                      id={`${type}-active`}
                      checked={pixel?.is_active || false}
                      onCheckedChange={(checked) => handlePixelChange(type, "is_active", checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      id={`${type}-id`}
                      placeholder={placeholder}
                      value={pixel?.pixel_id || ""}
                      onChange={(e) => handlePixelChange(type, "pixel_id", e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => handleSave(type)}
                    disabled={isSaving || !pixel?.pixel_id?.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                  {pixel?.id && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(type)}
                      disabled={isSaving}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Como funciona:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Os pixels ativos serão injetados automaticamente em todas as páginas do site</li>
              <li>O Facebook Pixel rastreia eventos como PageView automaticamente</li>
              <li>O Google Analytics 4 rastreia pageviews e eventos automaticamente</li>
              <li>O Google Tag Manager permite configuração avançada através do painel do GTM</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
