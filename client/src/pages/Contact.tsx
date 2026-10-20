import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { ContactBlock, SiteFooter, SiteHeader, usePageMeta } from "@/components/PolinaLayout";
import { DEFAULT_SITE_CONTENT, isSiteContent } from "@/lib/site-content";
import { trpc } from "@/lib/trpc";

export default function ContactPage() {
  const homeQuery = trpc.catalog.home.useQuery();
  const content = isSiteContent(homeQuery.data) ? homeQuery.data : DEFAULT_SITE_CONTENT;
  usePageMeta("Contact POLINA", "Official contact details published by POLINA.");

  return (
    <div className="site-shell"><SiteHeader /><main className="contact-page">
      <div className="contact-page__eyebrow"><span className="mono-label">POLINA / CONTACT</span><span className="mono-label">CHANNELS ARE BRAND-MANAGED</span></div>
      <h1>LET'S<br /><em>TALK.</em></h1>
      <p className="contact-page__intro">{content.footerNote}</p>
      <ContactBlock links={content.contactLinks} />
      <div className="contact-page__bottom"><span className="mono-label">NO CUSTOMER ACCOUNT REQUIRED</span><Link className="text-link" href="/collections">Return to the collection <ArrowUpRight size={15} /></Link></div>
      {homeQuery.error ? <p className="inline-error" role="status">Contact details could not be loaded. Try again later.</p> : null}
    </main><SiteFooter note={content.footerNote} contactLinks={content.contactLinks} /></div>
  );
}
