import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProfileGateAlert({ completionPercent, userType }: { completionPercent?: number; userType?: "company" | "freelancer" }) {
  return (
    <Alert>
      <AlertTitle>Complete seu perfil</AlertTitle>
      <AlertDescription>
        {userType || "user"}: {completionPercent || 0}%
      </AlertDescription>
    </Alert>
  );
}
