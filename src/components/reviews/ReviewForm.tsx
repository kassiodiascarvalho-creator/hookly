import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReviewFormProps {
  projectId: string;
  freelancerUserId: string;
  onReviewSubmitted?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewForm({
  projectId,
  freelancerUserId,
  onReviewSubmitted,
  open,
  onOpenChange
}: ReviewFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        project_id: projectId,
        freelancer_user_id: freelancerUserId,
        company_user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      // Create notification for freelancer
      await supabase.from("notifications").insert({
        user_id: freelancerUserId,
        type: "review",
        message: t("notifications.newReview"),
        link: `/freelancers/${freelancerUserId}`,
      });

      toast.success(t("reviews.submitted"));
      setRating(0);
      setComment("");
      onOpenChange(false);
      onReviewSubmitted?.();
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reviews.leaveReview")}</DialogTitle>
          <DialogDescription>{t("reviews.leaveReviewDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{t("reviews.rating")}</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      (hoveredRating || rating) >= star
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-muted-foreground"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("reviews.comment")}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("reviews.commentPlaceholder")}
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("reviews.submitReview")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
