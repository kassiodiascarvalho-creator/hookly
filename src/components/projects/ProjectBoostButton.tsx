import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

interface ProjectBoostButtonProps {
  projectId: string;
  projectStatus?: string;
  boostedUntil?: string | null;
  onBoostSuccess?: () => void;
  variant?: "compact" | "default";
}

export function ProjectBoostButton({ onBoostSuccess, variant = "default" }: ProjectBoostButtonProps) {
  return (
    <Button variant="outline" size={variant === "compact" ? "sm" : "default"} onClick={onBoostSuccess}>
      <Rocket className="mr-2 h-4 w-4" />
      Boost
    </Button>
  );
}
