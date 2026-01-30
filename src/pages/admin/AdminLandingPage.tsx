import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  useLandingSections, 
  useLandingFaqItems, 
  useLandingStats,
  useLandingSocialLinks,
  useUpdateLandingSection,
  useUpdateLandingFaq,
  useCreateLandingFaq,
  useDeleteLandingFaq,
  useUpdateLandingStat,
  useCreateLandingStat,
  useDeleteLandingStat,
  useUpdateLandingSocialLink,
  useCreateLandingSocialLink,
  useDeleteLandingSocialLink,
  LandingSection,
  LandingFaqItem,
  LandingStat,
  LandingSocialLink,
} from "@/hooks/useLandingContent";
import { SectionEditorRouter } from "@/components/admin/landing/SectionEditors";
import { 
  Eye, 
  EyeOff, 
  Save, 
  Plus, 
  Trash2, 
  Image, 
  GripVertical,
  ExternalLink,
  FileText,
  HelpCircle,
  BarChart3,
  Palette,
  Share2,
  Instagram,
  Facebook,
  MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVAILABLE_ICONS = [
  "Users", "Briefcase", "Star", "Globe", "Shield", "Zap", "Award", "Clock", "Check", "Heart"
];

const SOCIAL_ICONS = [
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

function FaqManager() {
  const { data: faqs, isLoading } = useLandingFaqItems();
  const updateFaq = useUpdateLandingFaq();
  const createFaq = useCreateLandingFaq();
  const deleteFaq = useDeleteLandingFaq();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingFaq, setEditingFaq] = useState<LandingFaqItem | null>(null);

  const handleAddFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    
    createFaq.mutate({
      question: newQuestion,
      answer: newAnswer,
      display_order: (faqs?.length || 0) + 1,
      is_visible: true,
    }, {
      onSuccess: () => {
        setNewQuestion("");
        setNewAnswer("");
        setIsAddDialogOpen(false);
      }
    });
  };

  const handleUpdateFaq = () => {
    if (!editingFaq) return;
    
    updateFaq.mutate({
      id: editingFaq.id,
      question: editingFaq.question,
      answer: editingFaq.answer,
      is_visible: editingFaq.is_visible,
    }, {
      onSuccess: () => setEditingFaq(null)
    });
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Perguntas Frequentes ({faqs?.length || 0})</h3>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar FAQ
        </Button>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs?.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className={faq.is_visible ? "" : "text-muted-foreground line-through"}>
                  {faq.question}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Pergunta</Label>
                  <Input 
                    value={faq.question}
                    onChange={(e) => setEditingFaq({ ...faq, question: e.target.value })}
                    onBlur={() => editingFaq?.id === faq.id && handleUpdateFaq()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resposta</Label>
                  <Textarea 
                    value={faq.answer}
                    onChange={(e) => setEditingFaq({ ...faq, answer: e.target.value })}
                    onBlur={() => editingFaq?.id === faq.id && handleUpdateFaq()}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={faq.is_visible}
                      onCheckedChange={(checked) => {
                        updateFaq.mutate({ id: faq.id, is_visible: checked });
                      }}
                    />
                    <Label>Visível</Label>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteFaq.mutate(faq.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Add FAQ Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Pergunta Frequente</DialogTitle>
            <DialogDescription>
              Adicione uma nova pergunta e resposta ao FAQ da landing page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Input 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Digite a pergunta..."
              />
            </div>
            <div className="space-y-2">
              <Label>Resposta</Label>
              <Textarea 
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Digite a resposta..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddFaq} disabled={createFaq.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsManager() {
  const { data: stats, isLoading } = useLandingStats();
  const updateStat = useUpdateLandingStat();
  const createStat = useCreateLandingStat();
  const deleteStat = useDeleteLandingStat();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStat, setNewStat] = useState({ label: "", value: "", icon: "Users" });

  const handleAddStat = () => {
    if (!newStat.label.trim() || !newStat.value.trim()) return;
    
    createStat.mutate({
      label: newStat.label,
      value: newStat.value,
      icon: newStat.icon,
      display_order: (stats?.length || 0) + 1,
      is_visible: true,
    }, {
      onSuccess: () => {
        setNewStat({ label: "", value: "", icon: "Users" });
        setIsAddDialogOpen(false);
      }
    });
  };

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Estatísticas ({stats?.length || 0})</h3>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Estatística
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats?.map((stat) => (
          <Card key={stat.id} className={stat.is_visible ? "" : "opacity-50"}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Select
                  value={stat.icon}
                  onValueChange={(value) => updateStat.mutate({ id: stat.id, icon: value })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Switch
                  checked={stat.is_visible}
                  onCheckedChange={(checked) => updateStat.mutate({ id: stat.id, is_visible: checked })}
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={stat.value}
                  onChange={(e) => updateStat.mutate({ id: stat.id, value: e.target.value })}
                  placeholder="2,500+"
                  className="text-2xl font-bold text-center"
                />
                <Input
                  value={stat.label}
                  onChange={(e) => updateStat.mutate({ id: stat.id, label: e.target.value })}
                  placeholder="Talentos"
                  className="text-sm text-center"
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-destructive hover:text-destructive"
                onClick={() => deleteStat.mutate(stat.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Stat Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Estatística</DialogTitle>
            <DialogDescription>
              Adicione uma nova estatística ao hero da landing page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input 
                value={newStat.value}
                onChange={(e) => setNewStat(prev => ({ ...prev, value: e.target.value }))}
                placeholder="2,500+"
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input 
                value={newStat.label}
                onChange={(e) => setNewStat(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Talentos Verificados"
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={newStat.icon}
                onValueChange={(value) => setNewStat(prev => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddStat} disabled={createStat.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialLinksManager() {
  const { data: links, isLoading } = useLandingSocialLinks();
  const updateLink = useUpdateLandingSocialLink();
  const createLink = useCreateLandingSocialLink();
  const deleteLink = useDeleteLandingSocialLink();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({ platform: "", url: "", icon: "instagram" });

  const handleAddLink = () => {
    if (!newLink.platform.trim()) return;
    
    createLink.mutate({
      platform: newLink.platform,
      url: newLink.url || null,
      icon: newLink.icon,
      display_order: (links?.length || 0) + 1,
      is_visible: true,
    }, {
      onSuccess: () => {
        setNewLink({ platform: "", url: "", icon: "instagram" });
        setIsAddDialogOpen(false);
      }
    });
  };

  if (isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Redes Sociais ({links?.length || 0})</h3>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Rede Social
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links?.map((link) => (
          <Card key={link.id} className={link.is_visible ? "" : "opacity-50"}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {link.icon === 'instagram' && <Instagram className="h-5 w-5 text-pink-500" />}
                  {link.icon === 'facebook' && <Facebook className="h-5 w-5 text-blue-600" />}
                  {link.icon === 'whatsapp' && <MessageCircle className="h-5 w-5 text-green-500" />}
                  {link.icon === 'twitter' && <Share2 className="h-5 w-5 text-sky-500" />}
                  {link.icon === 'linkedin' && <Share2 className="h-5 w-5 text-blue-700" />}
                  {link.icon === 'github' && <Share2 className="h-5 w-5" />}
                  {link.icon === 'youtube' && <Share2 className="h-5 w-5 text-red-500" />}
                  {link.icon === 'tiktok' && <Share2 className="h-5 w-5" />}
                  <span className="font-medium">{link.platform}</span>
                </div>
                <Switch
                  checked={link.is_visible}
                  onCheckedChange={(checked) => updateLink.mutate({ id: link.id, is_visible: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={link.icon}
                  onValueChange={(value) => updateLink.mutate({ id: link.id, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_ICONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome da Plataforma</Label>
                <Input
                  value={link.platform}
                  onChange={(e) => updateLink.mutate({ id: link.id, platform: e.target.value })}
                  placeholder="Instagram"
                />
              </div>

              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={link.url || ""}
                  onChange={(e) => updateLink.mutate({ id: link.id, url: e.target.value })}
                  placeholder="https://instagram.com/hookly"
                />
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-destructive hover:text-destructive"
                onClick={() => deleteLink.mutate(link.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Social Link Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Rede Social</DialogTitle>
            <DialogDescription>
              Adicione um novo link de rede social ao footer da landing page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Input 
                value={newLink.platform}
                onChange={(e) => setNewLink(prev => ({ ...prev, platform: e.target.value }))}
                placeholder="Instagram"
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input 
                value={newLink.url}
                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://instagram.com/hookly"
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={newLink.icon}
                onValueChange={(value) => setNewLink(prev => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_ICONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddLink} disabled={createLink.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminLandingPage() {
  const { t } = useTranslation();
  const { data: sections, isLoading } = useLandingSections();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editor da Landing Page</h1>
          <p className="text-muted-foreground">
            Gerencie todo o conteúdo da página inicial
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visualizar Site
          </a>
        </Button>
      </div>

      <Tabs defaultValue="sections" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sections" className="gap-2">
            <FileText className="h-4 w-4" />
            Seções
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Estatísticas
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            Redes Sociais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : (
            sections?.map((section) => (
              <SectionEditor key={section.id} section={section} />
            ))
          )}
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Gerenciar FAQ
              </CardTitle>
              <CardDescription>
                Adicione, edite ou remova perguntas frequentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaqManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Gerenciar Estatísticas
              </CardTitle>
              <CardDescription>
                Edite os números exibidos no hero da landing page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatsManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Gerenciar Redes Sociais
              </CardTitle>
              <CardDescription>
                Edite os links e ícones das redes sociais no footer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SocialLinksManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
