import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, ExternalLink, Loader2, Award, Save, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_url: string | null;
}

export default function CertificationsManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");

  useEffect(() => {
    if (user) fetchCertifications();
  }, [user]);

  const fetchCertifications = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("certifications")
      .select("*")
      .eq("freelancer_user_id", user.id)
      .order("issue_date", { ascending: false });
    
    if (data) setCertifications(data);
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setIssuer("");
    setIssueDate("");
    setExpiryDate("");
    setCredentialUrl("");
    setEditingCert(null);
  };

  const openEditDialog = (cert: Certification) => {
    setEditingCert(cert);
    setName(cert.name);
    setIssuer(cert.issuer || "");
    setIssueDate(cert.issue_date || "");
    setExpiryDate(cert.expiry_date || "");
    setCredentialUrl(cert.credential_url || "");
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);

    try {
      const certData = {
        name: name.trim(),
        issuer: issuer.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        credential_url: credentialUrl.trim() || null,
      };

      if (editingCert) {
        const { error } = await supabase
          .from("certifications")
          .update(certData)
          .eq("id", editingCert.id);
        
        if (error) throw error;
        toast.success(t("certifications.updated"));
      } else {
        const { error } = await supabase
          .from("certifications")
          .insert({ ...certData, freelancer_user_id: user.id });
        
        if (error) throw error;
        toast.success(t("certifications.added"));
      }

      setDialogOpen(false);
      resetForm();
      fetchCertifications();
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("certifications")
      .delete()
      .eq("id", id);
    
    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("certifications.deleted"));
      fetchCertifications();
    }
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
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
          <CardTitle>{t("certifications.title")}</CardTitle>
          <CardDescription>{t("certifications.description")}</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNewDialog}>
              <Plus className="h-4 w-4" />
              {t("certifications.addCert")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCert ? t("certifications.editCert") : t("certifications.addCert")}
              </DialogTitle>
              <DialogDescription>
                {t("certifications.certDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("certifications.certName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("certifications.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("certifications.issuer")}</Label>
                <Input
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder={t("certifications.issuerPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("certifications.issueDate")}</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("certifications.expiryDate")}</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("certifications.credentialUrl")}</Label>
                <Input
                  value={credentialUrl}
                  onChange={(e) => setCredentialUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {certifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("certifications.noCerts")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {certifications.map((cert) => (
              <div 
                key={cert.id} 
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{cert.name}</h4>
                    {cert.issuer && (
                      <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {cert.issue_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("certifications.issued")}: {format(new Date(cert.issue_date), "MMM yyyy")}
                        </span>
                      )}
                      {cert.expiry_date && (
                        <span className={`flex items-center gap-1 ${isExpired(cert.expiry_date) ? 'text-destructive' : ''}`}>
                          {t("certifications.expires")}: {format(new Date(cert.expiry_date), "MMM yyyy")}
                          {isExpired(cert.expiry_date) && ` (${t("certifications.expired")})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {cert.credential_url && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => window.open(cert.credential_url!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => openEditDialog(cert)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDelete(cert.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
