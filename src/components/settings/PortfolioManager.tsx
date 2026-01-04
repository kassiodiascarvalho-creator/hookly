import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, ExternalLink, Loader2, Image, Save } from "lucide-react";

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  project_url: string | null;
  tags: string[] | null;
}

export default function PortfolioManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [tags, setTags] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("portfolio_items")
      .select("*")
      .eq("freelancer_user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (data) setItems(data);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setProjectUrl("");
    setTags("");
    setImageFile(null);
    setImagePreview(null);
    setEditingItem(null);
  };

  const openEditDialog = (item: PortfolioItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || "");
    setProjectUrl(item.project_url || "");
    setTags(item.tags?.join(", ") || "");
    setImagePreview(item.image_url);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);

    try {
      let imageUrl = editingItem?.image_url || null;
      
      // Upload new image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("portfolio")
          .upload(filePath, imageFile, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from("portfolio")
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      const itemData = {
        title: title.trim(),
        description: description.trim() || null,
        project_url: projectUrl.trim() || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        image_url: imageUrl,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("portfolio_items")
          .update(itemData)
          .eq("id", editingItem.id);
        
        if (error) throw error;
        toast.success(t("portfolio.updated"));
      } else {
        const { error } = await supabase
          .from("portfolio_items")
          .insert({ ...itemData, freelancer_user_id: user.id });
        
        if (error) throw error;
        toast.success(t("portfolio.added"));
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("portfolio_items")
      .delete()
      .eq("id", id);
    
    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("portfolio.deleted"));
      fetchItems();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("portfolio.title")}</CardTitle>
          <CardDescription>{t("portfolio.description")}</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNewDialog}>
              <Plus className="h-4 w-4" />
              {t("portfolio.addItem")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? t("portfolio.editItem") : t("portfolio.addItem")}
              </DialogTitle>
              <DialogDescription>
                {t("portfolio.itemDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>{t("portfolio.image")}</Label>
                <div className="flex items-center gap-4">
                  {imagePreview && (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  )}
                  <div>
                    <input
                      type="file"
                      id="portfolio-image"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => document.getElementById("portfolio-image")?.click()}
                      className="gap-2"
                    >
                      <Image className="h-4 w-4" />
                      {t("portfolio.uploadImage")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("portfolio.itemTitle")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("portfolio.titlePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("portfolio.itemDesc")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("portfolio.descPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("portfolio.projectUrl")}</Label>
                <Input
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>{t("portfolio.tags")}</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t("portfolio.tagsPlaceholder")}
                />
              </div>

              <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("portfolio.noItems")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg overflow-hidden group">
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-semibold mb-1">{item.title}</h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {item.description}
                    </p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="text-xs bg-muted px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {item.project_url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(item.project_url!, "_blank")}
                        className="gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t("common.view")}
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
