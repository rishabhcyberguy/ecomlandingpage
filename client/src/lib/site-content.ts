import type { ContactLink } from "@/components/SocialFlipButton";
import { normalizeInternalPath } from "@shared/internal-path";

export type SiteContent = {
  heroHeading: string;
  heroDescription: string;
  heroCtaLabel: string;
  heroCtaTarget: string;
  editorialHeading: string;
  editorialBody: string;
  footerNote: string;
  contactLinks: ContactLink[];
  featuredProductIds?: number[];
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  heroHeading: "POLINA",
  heroDescription: "Sample campaign copy — replace with POLINA-approved brand text.",
  heroCtaLabel: "Explore the collection",
  heroCtaTarget: "/collections",
  editorialHeading: "Made for your own kind of night.",
  editorialBody: "Editable sample story. Add the POLINA brand statement and approved collection details in the content editor.",
  footerNote: "Sample footer note — replace before launch.",
  contactLinks: [],
  featuredProductIds: [],
};

export function isSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== "object") return false;
  const content = value as Partial<SiteContent>;
  return typeof content.heroHeading === "string"
    && typeof content.heroDescription === "string"
    && Array.isArray(content.contactLinks)
    && (content.featuredProductIds === undefined || (Array.isArray(content.featuredProductIds) && content.featuredProductIds.every((id) => Number.isInteger(id) && id > 0)));
}

export function safeInternalTarget(value: string) {
  return normalizeInternalPath(value) ?? "/collections";
}
