import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const { t } = useTranslation();

  const passwordChecks = {
    minLength: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        {t("auth.passwordRequirementsIntro")}
      </p>
      <ul className="space-y-1 text-xs">
        <li className="flex items-center gap-2">
          {passwordChecks.minLength ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{t("auth.passwordRuleMinLength")}</span>
        </li>
        <li className="flex items-center gap-2">
          {passwordChecks.letter ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{t("auth.passwordRuleLetter")}</span>
        </li>
        <li className="flex items-center gap-2">
          {passwordChecks.number ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{t("auth.passwordRuleNumber")}</span>
        </li>
        <li className="flex items-center gap-2">
          {passwordChecks.special ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{t("auth.passwordRuleSpecial")}</span>
        </li>
      </ul>
    </div>
  );
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
