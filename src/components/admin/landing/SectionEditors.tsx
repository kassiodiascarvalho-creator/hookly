import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Save, Image, Palette, GripVertical } from "lucide-react";
import { LandingSection, useUpdateLandingSection } from "@/hooks/useLandingContent";

interface SectionEditorProps {
  section: LandingSection;
}

// Hero Section Editor - Full control over all hero content
export function HeroSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    titleLine2: "",
    titleLine3: "",
    subtitle: "",
    ctaPrimary: "",
    ctaSecondary: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [bgImage, setBgImage] = useState(section.background_image_url || "");
  const [bgColor, setBgColor] = useState(section.background_color || "");
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      background_image_url: bgImage || null,
      background_color: bgColor || null,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Hero Section</CardTitle>
              <CardDescription>Seção principal com título e call-to-action</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título (Linha 1)</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Conecte-se aos Melhores" />
          </div>
          <div className="space-y-2">
            <Label>Título (Linha 2)</Label>
            <Input value={localContent.titleLine2} onChange={(e) => setLocalContent(prev => ({ ...prev, titleLine2: e.target.value }))} placeholder="Talentos do Mercado" />
          </div>
          <div className="space-y-2">
            <Label>Título (Linha 3 - Destaque)</Label>
            <Input value={localContent.titleLine3} onChange={(e) => setLocalContent(prev => ({ ...prev, titleLine3: e.target.value }))} placeholder="Freelancers Premium, Resultados Reais" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Subtítulo</Label>
            <Textarea value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Plataforma completa para contratar freelancers..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Botão Principal (CTA)</Label>
            <Input value={localContent.ctaPrimary} onChange={(e) => setLocalContent(prev => ({ ...prev, ctaPrimary: e.target.value }))} placeholder="Começar Agora" />
          </div>
          <div className="space-y-2">
            <Label>Botão Secundário</Label>
            <Input value={localContent.ctaSecondary} onChange={(e) => setLocalContent(prev => ({ ...prev, ctaSecondary: e.target.value }))} placeholder="Ver Talentos" />
          </div>
        </div>
        <BackgroundSettings bgImage={bgImage} setBgImage={setBgImage} bgColor={bgColor} setBgColor={setBgColor} sectionId={section.id} />
      </CardContent>
    </Card>
  );
}

// Categories Section Editor
export function CategoriesSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    viewAllText: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Categorias</CardTitle>
              <CardDescription>Seção de categorias de serviços</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Encontre Talentos por Categoria" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Profissionais especializados..." />
          </div>
          <div className="space-y-2">
            <Label>Texto do Botão "Ver Todos"</Label>
            <Input value={localContent.viewAllText || ""} onChange={(e) => setLocalContent(prev => ({ ...prev, viewAllText: e.target.value }))} placeholder="Ver Todas as Categorias" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// How It Works Section Editor
export function HowItWorksSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    step1Title: "",
    step1Description: "",
    step2Title: "",
    step2Description: "",
    step3Title: "",
    step3Description: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Como Funciona</CardTitle>
              <CardDescription>Passos do processo</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Como Funciona" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Processo simples..." />
          </div>
        </div>
        
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Passo 1</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título do Passo 1</Label>
              <Input value={localContent.step1Title} onChange={(e) => setLocalContent(prev => ({ ...prev, step1Title: e.target.value }))} placeholder="Publique seu Projeto" />
            </div>
            <div className="space-y-2">
              <Label>Descrição do Passo 1</Label>
              <Textarea value={localContent.step1Description} onChange={(e) => setLocalContent(prev => ({ ...prev, step1Description: e.target.value }))} rows={2} />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Passo 2</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título do Passo 2</Label>
              <Input value={localContent.step2Title} onChange={(e) => setLocalContent(prev => ({ ...prev, step2Title: e.target.value }))} placeholder="Receba Propostas" />
            </div>
            <div className="space-y-2">
              <Label>Descrição do Passo 2</Label>
              <Textarea value={localContent.step2Description} onChange={(e) => setLocalContent(prev => ({ ...prev, step2Description: e.target.value }))} rows={2} />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Passo 3</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título do Passo 3</Label>
              <Input value={localContent.step3Title} onChange={(e) => setLocalContent(prev => ({ ...prev, step3Title: e.target.value }))} placeholder="Contrate com Segurança" />
            </div>
            <div className="space-y-2">
              <Label>Descrição do Passo 3</Label>
              <Textarea value={localContent.step3Description} onChange={(e) => setLocalContent(prev => ({ ...prev, step3Description: e.target.value }))} rows={2} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Comparison Section Editor
export function ComparisonSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Comparação</CardTitle>
              <CardDescription>Tabela comparativa com concorrentes</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Por que escolher o HOOKLY?" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Veja como nos destacamos..." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pricing Section Editor
export function PricingSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    starterName: "",
    starterDescription: "",
    starterPrice: "",
    starterCta: "",
    businessName: "",
    businessDescription: "",
    businessPrice: "",
    businessCta: "",
    businessPopular: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Preços</CardTitle>
              <CardDescription>Planos e preços</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Planos Simples" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Escolha o plano ideal..." />
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Plano Starter</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input value={localContent.starterName} onChange={(e) => setLocalContent(prev => ({ ...prev, starterName: e.target.value }))} placeholder="Starter" />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input value={localContent.starterPrice} onChange={(e) => setLocalContent(prev => ({ ...prev, starterPrice: e.target.value }))} placeholder="Grátis" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Input value={localContent.starterDescription} onChange={(e) => setLocalContent(prev => ({ ...prev, starterDescription: e.target.value }))} placeholder="Ideal para começar..." />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input value={localContent.starterCta} onChange={(e) => setLocalContent(prev => ({ ...prev, starterCta: e.target.value }))} placeholder="Começar Grátis" />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Plano Business</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input value={localContent.businessName} onChange={(e) => setLocalContent(prev => ({ ...prev, businessName: e.target.value }))} placeholder="Business" />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input value={localContent.businessPrice} onChange={(e) => setLocalContent(prev => ({ ...prev, businessPrice: e.target.value }))} placeholder="$49/mês" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Input value={localContent.businessDescription} onChange={(e) => setLocalContent(prev => ({ ...prev, businessDescription: e.target.value }))} placeholder="Para empresas que..." />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input value={localContent.businessCta} onChange={(e) => setLocalContent(prev => ({ ...prev, businessCta: e.target.value }))} placeholder="Assinar Agora" />
            </div>
            <div className="space-y-2">
              <Label>Badge "Popular"</Label>
              <Input value={localContent.businessPopular} onChange={(e) => setLocalContent(prev => ({ ...prev, businessPopular: e.target.value }))} placeholder="Mais Popular" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Testimonials Section Editor
export function TestimonialsSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Depoimentos</CardTitle>
              <CardDescription>Seção de depoimentos de clientes</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="O que dizem nossos clientes" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Histórias de sucesso..." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// FAQ Section Editor
export function FaqSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">FAQ</CardTitle>
              <CardDescription>Perguntas Frequentes (itens gerenciados na aba FAQ)</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título da Seção</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Perguntas Frequentes" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Tire suas dúvidas..." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// CTA Section Editor
export function CtaSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    title: "",
    subtitle: "",
    ctaPrimary: "",
    ctaSecondary: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [bgImage, setBgImage] = useState(section.background_image_url || "");
  const [bgColor, setBgColor] = useState(section.background_color || "");
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      background_image_url: bgImage || null,
      background_color: bgColor || null,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Call to Action Final</CardTitle>
              <CardDescription>Seção de conversão final</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={localContent.title} onChange={(e) => setLocalContent(prev => ({ ...prev, title: e.target.value }))} placeholder="Pronto para Começar?" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input value={localContent.subtitle} onChange={(e) => setLocalContent(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Junte-se a milhares..." />
          </div>
          <div className="space-y-2">
            <Label>Botão Principal (CTA)</Label>
            <Input value={localContent.ctaPrimary} onChange={(e) => setLocalContent(prev => ({ ...prev, ctaPrimary: e.target.value }))} placeholder="Criar Conta Grátis" />
          </div>
          <div className="space-y-2">
            <Label>Botão Secundário</Label>
            <Input value={localContent.ctaSecondary} onChange={(e) => setLocalContent(prev => ({ ...prev, ctaSecondary: e.target.value }))} placeholder="Falar com Especialista" />
          </div>
        </div>
        <BackgroundSettings bgImage={bgImage} setBgImage={setBgImage} bgColor={bgColor} setBgColor={setBgColor} sectionId={section.id} />
      </CardContent>
    </Card>
  );
}

// Footer Section Editor
export function FooterSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState<Record<string, string>>({
    copyright: "",
    description: "",
    ...((section.content as Record<string, string>) || {}),
  });
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      is_visible: isVisible,
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">Footer</CardTitle>
              <CardDescription>Rodapé da página (redes sociais gerenciadas na aba Redes Sociais)</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição da Empresa</Label>
            <Textarea value={localContent.description} onChange={(e) => setLocalContent(prev => ({ ...prev, description: e.target.value }))} placeholder="Plataforma premium para conectar empresas..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Texto de Copyright</Label>
            <Input value={localContent.copyright} onChange={(e) => setLocalContent(prev => ({ ...prev, copyright: e.target.value }))} placeholder="© 2024 HOOKLY. Todos os direitos reservados." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Shared Background Settings Component
function BackgroundSettings({ bgImage, setBgImage, bgColor, setBgColor, sectionId }: {
  bgImage: string;
  setBgImage: (val: string) => void;
  bgColor: string;
  setBgColor: (val: string) => void;
  sectionId: string;
}) {
  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Configurações de Fundo
      </h4>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${sectionId}-bg-image`}>URL da Imagem de Fundo</Label>
          <div className="flex gap-2">
            <Input
              id={`${sectionId}-bg-image`}
              value={bgImage}
              onChange={(e) => setBgImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <Button variant="outline" size="icon">
              <Image className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${sectionId}-bg-color`}>Cor de Fundo</Label>
          <div className="flex gap-2">
            <Input
              id={`${sectionId}-bg-color`}
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#000000 ou rgba(0,0,0,0.5)"
            />
            <input
              type="color"
              value={bgColor || "#000000"}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Generic fallback editor for unknown sections
export function GenericSectionEditor({ section }: SectionEditorProps) {
  const updateSection = useUpdateLandingSection();
  const [localContent, setLocalContent] = useState(section.content || {});
  const [bgImage, setBgImage] = useState(section.background_image_url || "");
  const [bgColor, setBgColor] = useState(section.background_color || "");
  const [isVisible, setIsVisible] = useState(section.is_visible);

  const handleSave = () => {
    updateSection.mutate({
      id: section.id,
      content: localContent,
      background_image_url: bgImage || null,
      background_color: bgColor || null,
      is_visible: isVisible,
    });
  };

  const handleContentChange = (key: string, value: string) => {
    setLocalContent(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div>
              <CardTitle className="text-lg">{section.title || section.section_key}</CardTitle>
              <CardDescription>{section.subtitle}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-2" />
              {updateSection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(localContent as Record<string, string>).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`${section.id}-${key}`} className="capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              {typeof value === 'string' && value.length > 100 ? (
                <Textarea
                  id={`${section.id}-${key}`}
                  value={value}
                  onChange={(e) => handleContentChange(key, e.target.value)}
                  rows={3}
                />
              ) : (
                <Input
                  id={`${section.id}-${key}`}
                  value={value as string}
                  onChange={(e) => handleContentChange(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <BackgroundSettings bgImage={bgImage} setBgImage={setBgImage} bgColor={bgColor} setBgColor={setBgColor} sectionId={section.id} />
      </CardContent>
    </Card>
  );
}

// Section Router - picks the right editor based on section_key
export function SectionEditorRouter({ section }: SectionEditorProps) {
  switch (section.section_key) {
    case 'hero':
      return <HeroSectionEditor section={section} />;
    case 'categories':
      return <CategoriesSectionEditor section={section} />;
    case 'howItWorks':
      return <HowItWorksSectionEditor section={section} />;
    case 'comparison':
      return <ComparisonSectionEditor section={section} />;
    case 'pricing':
      return <PricingSectionEditor section={section} />;
    case 'testimonials':
      return <TestimonialsSectionEditor section={section} />;
    case 'faq':
      return <FaqSectionEditor section={section} />;
    case 'cta':
      return <CtaSectionEditor section={section} />;
    case 'footer':
      return <FooterSectionEditor section={section} />;
    default:
      return <GenericSectionEditor section={section} />;
  }
}
