import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export const Logo = ({ className = "", size = "md", onClick }: LogoProps) => {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn("flex items-center", className)}
    >
      <img
        src="https://i.imgur.com/HZ11EDZ.png"
        alt="HOOKLY"
        className={cn("object-contain w-auto", sizeClasses[size])}
      />
    </Component>
  );
};
