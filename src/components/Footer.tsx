import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>© Skein. Made for one person at a time.</span>
        <nav className="flex items-center gap-5">
          <Link to="/pricing" className="hover:text-bone">Pricing</Link>
          <Link to="/faq" className="hover:text-bone">FAQ</Link>
          <Link to="/demo" className="hover:text-bone">Demo</Link>
          <Link to="/auth" className="hover:text-bone">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
