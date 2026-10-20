import { useEffect } from "react";

export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const warnBeforeInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      try {
        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      } catch {
        return;
      }
      if (!window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeInternalLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeInternalLink, true);
    };
  }, [dirty]);
}
