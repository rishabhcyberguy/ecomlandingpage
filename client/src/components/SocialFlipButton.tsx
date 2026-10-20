import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { Link2 } from "lucide-react";
import { normalizeContactHref } from "@shared/contact-link";
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

const contactLetters = "CONTACT";
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

export default function SocialFlipButton({ items = [] }: { items?: ContactLink[] }) {
  const instanceId = useId();
  const [focused, setFocused] = useState<number | null>(null);
  const reduceMotion = useReducedMotion() !== false;
  const [touchLike, setTouchLike] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches);

  useEffect(() => {
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = (event: MediaQueryListEvent) => setTouchLike(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const validItems = items.flatMap((item) => {
    const safeHref = normalizeContactHref(item.href);
    return safeHref ? [{ ...item, safeHref }] : [];
  });
  const staticPresentation = reduceMotion || touchLike;
  const slotCount = Math.max(contactLetters.length, validItems.length);

  return (
    <div className="social-flip-shell" role="group" aria-label="POLINA contact links">
      <div
        className={`social-flip-group${validItems.length > contactLetters.length ? " social-flip-group--extended" : ""}`}
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
        {Array.from({ length: slotCount }, (_, index) => {
          const letter = contactLetters[index] ?? "+";
          const item = validItems[index];
          const active = focused === index;

          if (!item) {
            return (
              <span
                key={`pending-${index}`}
                className="social-flip-link social-flip-link--pending"
                aria-hidden="true"
                onMouseEnter={() => { if (!staticPresentation) setFocused(index); }}
              >
                <span className="social-flip-perspective">
                  {staticPresentation ? (
                    <span className="social-flip-static social-flip-static--letter">{letter}</span>
                  ) : (
                    <motion.span
                      className="social-flip-cube"
                      animate={{ rotateY: active ? 180 : 0 }}
                      transition={{ duration: 0.44, type: "spring", stiffness: 130, damping: 17 }}
                    >
                      <span className="social-flip-face social-flip-face--front">{letter}</span>
                      <span className="social-flip-face social-flip-face--back"><Link2 size={17} aria-hidden="true" /></span>
                    </motion.span>
                  )}
                </span>
                <AnimatePresence>
                  {!staticPresentation && active ? (
                    <motion.span
                      className="social-flip-tooltip"
                      initial={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                      animate={{ opacity: 1, y: -44, x: "-50%", scale: 1 }}
                      exit={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                    >
                      Not configured
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            );
          }

          const Icon = icons[item.icon];
          const external = item.safeHref.startsWith("https:");
          const tooltipId = `${instanceId}-polina-contact-tooltip-${index}`;
          return (
            <a
              key={`${item.label}-${item.safeHref}`}
              className="social-flip-link"
              data-contact-index={index}
              href={item.safeHref}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              aria-label={`${item.label}${external ? ", opens in a new tab" : ""}`}
              aria-describedby={!staticPresentation && active ? tooltipId : undefined}
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
                {!staticPresentation && active ? (
                  <motion.span
                    id={tooltipId}
                    className="social-flip-tooltip"
                    role="tooltip"
                    initial={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                    animate={{ opacity: 1, y: -44, x: "-50%", scale: 1 }}
                    exit={{ opacity: 0, y: 6, x: "-50%", scale: 0.92 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    {item.label}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </a>
          );
        })}
      </div>
      {validItems.length < contactLetters.length ? (
        <p className="social-flip-note">Official contact links will appear here once POLINA publishes them.</p>
      ) : null}
    </div>
  );
}
