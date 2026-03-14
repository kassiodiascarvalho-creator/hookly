import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bug, Lightbulb, Loader2 } from "lucide-react";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "bug" | "suggestion";
  userType: "company" | "freelancer";
}

export function FeedbackModal({ open, onOpenChange, type, userType }: FeedbackModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBug = type === "bug";
  const Icon = isBug ? Bug : Lightbulb;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error(t("feedback.loginRequired"));
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast.error(t("feedback.fillAllFields"));
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await (supabase.from("user_feedbacks" as any) as any).insert({
        user_id: user.id,
        user_type: userType,
        feedback_type: type,
        title: title.trim(),
        description: description.trim(),
        page_url: location.pathname,
      });

      if (error) throw error;

      toast.success(isBug ? t("feedback.bugReported") : t("feedback.suggestionSent"));
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(t("feedback.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isBug ? "text-destructive" : "text-primary"}`} />
            {isBug ? t("feedback.reportBug") : t("feedback.suggestImprovement")}
          </DialogTitle>
          <DialogDescription>
            {isBug ? t("feedback.bugDescription") : t("feedback.suggestionDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("feedback.title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBug ? t("feedback.bugTitlePlaceholder") : t("feedback.suggestionTitlePlaceholder")}
              disabled={isSubmitting}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("feedback.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isBug ? t("feedback.bugDescriptionPlaceholder") : t("feedback.suggestionDescriptionPlaceholder")}
              disabled={isSubmitting}
              rows={5}
              maxLength={2000}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {t("feedback.currentPage")}: {location.pathname}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("feedback.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
