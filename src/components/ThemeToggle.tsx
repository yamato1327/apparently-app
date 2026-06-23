import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  variant?: "header" | "inline";
  className?: string;
}

const ThemeToggle = ({ variant = "header", className = "" }: Props) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  if (variant === "header") {
    return (
      <button
        onClick={toggle}
        title={isDark ? "Switch to light" : "Switch to dark"}
        aria-label="Toggle theme"
        className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 text-white/85 transition-all hover:bg-white/20 hover:text-white active:scale-95 ${className}`}
      >
        <Sun className={`h-4 w-4 absolute transition-all ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
        <Moon className={`h-4 w-4 absolute transition-all ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:text-foreground hover:border-primary/40 active:scale-95 ${className}`}
    >
      <Sun className={`h-4 w-4 absolute transition-all ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon className={`h-4 w-4 absolute transition-all ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
};

export default ThemeToggle;