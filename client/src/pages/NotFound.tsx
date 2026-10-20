import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { usePageMeta, Wordmark } from "@/components/PolinaLayout";

export default function NotFound() {
  const [location] = useLocation();
  usePageMeta("Page not found — POLINA", "This POLINA page does not exist.", true);
  return (
    <main className="not-found-page">
      <Wordmark />
      <span className="mono-label">404 / WRONG TURN</span>
      <h1>THIS PAGE<br /><em>ISN'T HERE.</em></h1>
      <p>The link may be out of date, or the page may have been unpublished.</p>
      <div className="not-found-actions"><Link href="/" className="button-red"><ArrowLeft size={15} /> Back to POLINA</Link><Link href="/collections" className="text-link">Browse the collection <ArrowUpRight size={15} /></Link></div>
      <span className="not-found-path">{location}</span>
    </main>
  );
}
