import { Check } from "lucide-react";

export function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function PasswordRequirements({ password }: { password: string }) {
  const ok = isStrongPassword(password);
  return (
    <div className="text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Check className="h-3 w-3" />
        {ok ? "Senha forte" : "Use 8+ caracteres com letras e números"}
      </span>
    </div>
  );
}
