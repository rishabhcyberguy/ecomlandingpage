import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FaDiscord,
  FaEnvelope,
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaTwitter,
} from "react-icons/fa";

export type ContactLink = {
  label: string;
  href: string;
  icon: "email" | "instagram" | "facebook" | "linkedin" | "twitter" | "github" | "discord" | "other";
};

const icons = {
  email: FaEnvelope,
  instagram: FaInstagram,
  facebook: FaFacebook,
  linkedin: FaLinkedin,
  twitter: FaTwitter,
  github: FaGithub,
  discord: FaDiscord,
  other: FaEnvelope,
};

function allowedHref(href: string) {
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export default function SocialFlipButton({ items }: { items: ContactLink[] }) {
  const [focused, setFocused] = useState<number | null>(null);
  const reduceMotion = useReducedMotion() !== false;
  const [touchLike, setTouchLike] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  useEffect(() => {
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = (event: MediaQueryListEvent) => setTouchLike(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const validItems = items.filter((item) => allowedHref(item.href));
  const staticPresentation = reduceMotion || touchLike;
  if (!validItems.length) return null;

  return (
    <div className="social-flip-shell" role="group" aria-label="POLINA contact links">
      <div
        className="social-flip-group"
        onMouseLeave={() => setFocused(null)}
        onFocusCapture={(event) => {
          const link = (event.target as HTMLElement).closest<HTMLElement>("[data-contact-index]");
          setFocused(link ? Number(link.dataset.contactIndex) : null);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null);
        }}
      >
        <span className="social-flip-border social-flip-border--top" aria-hidden="true" />
        <span className="social-flip-border social-flip-border--bottom" aria-hidden="true" />
        {validItems.map((item, index) => {
          const Icon = icons[item.icon];
          const href = allowedHref(item.href);
          const external = href.startsWith("https:");
          const active = focused === index;
          const letter = "CONTACT"[index] ?? "+";
          return (
            <a
              key={`${item.label}-${item.href}`}
              className="social-flip-link"
              data-contact-index={index}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              aria-label={`${item.label}${external ? ", opens in a new tab" : ""}`}
              onMouseEnter={() => setFocused(index)}
            >
              <span className="social-flip-perspective">
                {staticPresentation ? (
                  <span className="social-flip-static">
                    <Icon aria-hidden="true" />
                    <span className="social-flip-static__label">{item.label}</span>
                  </span>
                ) : (
                  <motion.span
                    className="social-flip-cube"
                    animate={{ rotateY: active ? 180 : 0 }}
                    transition={{ duration: 0.44, type: "spring", stiffness: 130, damping: 17 }}
                  >
                    <span className="social-flip-face social-flip-face--front" aria-hidden="true">{letter}</span>
                    <span className="social-flip-face social-flip-face--back" aria-hidden="true"><Icon /></span>
                  </motion.span>
                )}
              </span>
              <AnimatePresence>
                {!staticPresentation && active && (
                  <motion.span
                    className="social-flip-tooltip"
                    role="tooltip"
                    initial={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                    animate={{ opacity: 1, y: -44, x: "-50%", scale: 1 }}
                    exit={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </a>
          );
        })}
      </div>
    </div>
  );
}
