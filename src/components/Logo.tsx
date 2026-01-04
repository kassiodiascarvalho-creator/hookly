import { Link } from "react-router-dom";

export const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`flex items-center gap-2 ${className}`}>
    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
      <span className="text-primary-foreground font-bold text-lg">H</span>
    </div>
    <span className="font-display font-bold text-xl">HOOKLY</span>
  </Link>
);
