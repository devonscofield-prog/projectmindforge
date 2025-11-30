import { Link, LinkProps } from "react-router-dom";
import { createPreloadHandlers } from "@/lib/routePreloader";

interface PreloadLinkProps extends LinkProps {
  to: string;
}

/**
 * Link component that preloads the target route on hover/focus
 * Use this for navigation links to improve perceived performance
 */
export function PreloadLink({ to, children, ...props }: PreloadLinkProps) {
  const preloadHandlers = createPreloadHandlers(to);

  return (
    <Link
      to={to}
      {...preloadHandlers}
      {...props}
    >
      {children}
    </Link>
  );
}
