import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export const Logo = ({ className = "", size = "md", onClick }: LogoProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
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
        src="https://i.imgur.com/0XQ4UGj.png"
        alt="HOOKLY"
        className={cn("object-contain", sizeClasses[size])}
      />
      <span className={cn("font-display font-bold text-foreground", textSizes[size])}>
        HOOKLY
      </span>
    </Component>
  );
};
