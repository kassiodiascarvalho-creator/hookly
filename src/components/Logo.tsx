import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  showText?: boolean;
}

export const Logo = ({ className = "", size = "md", onClick, showText = true }: LogoProps) => {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn("flex items-center gap-2", className)}
    >
      <img
        src="https://i.imgur.com/HZ11EDZ.png"
        alt="HOOKLY"
        className={cn("object-contain w-auto", sizeClasses[size])}
      />
      {showText && (
        <span className={cn("font-display font-bold text-foreground", textSizeClasses[size])}>
          HOOKLY
        </span>
      )}
    </Component>
  );
};
