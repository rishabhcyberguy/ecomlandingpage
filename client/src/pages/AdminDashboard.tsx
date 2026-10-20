import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowUpRight, Archive, Plus, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function displayDate(value: Date | string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminDashboardPage() {
  const utils = trpc.useUtils();
  const dashboard = trpc.admin.dashboard.useQuery();
  const products = trpc.admin.products.useQuery();
  const categories = trpc.admin.categories.useQuery();
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categorySuccess, setCategorySuccess] = useState("");
  const saveCategory = trpc.admin.saveCategory.useMutation({ onSuccess: async () => {
    setCategoryName("");
    setCategoryError("");
    setCategorySuccess("Category saved.");
    await Promise.all([utils.admin.categories.invalidate(), utils.admin.dashboard.invalidate()]);
  } });
  const archiveCategory = trpc.admin.archiveCategory.useMutation({ onSuccess: () => utils.admin.categories.invalidate() });
  const summary = dashboard.data;
  const productCount = useMemo(() => products.data?.length ?? 0, [products.data]);

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    saveCategory.mutate({ name, slug: slugify(name), sortOrder: categories.data?.length ?? 0 });
  };

  return (
    <main className="admin-content">
      <div className="admin-page-heading">
        <div><span className="mono-label">POLINA / CONTROL ROOM</span><h1>Overview<span className="red-dot">.</span></h1><p>Catalog health, content changes, and the next actions.</p></div>
        <div className="admin-heading-actions"><button className="admin-icon-button" type="button" onClick={() => { void dashboard.refetch(); void products.refetch(); }} aria-label="Refresh dashboard"><RefreshCw size={16} /></button><Link className="button-red" href="/admin/products/new"><Plus size={16} /> New product</Link></div>
      </div>
      {dashboard.error ? <div className="admin-alert admin-alert--error" role="alert">Dashboard data could not load. {dashboard.error.message}</div> : null}
      <div className="admin-stat-grid">
        <article className="admin-stat"><span className="mono-label">TOTAL PRODUCTS</span><strong>{summary?.total ?? 0}</strong><span>{productCount} currently listed</span></article>
        <article className="admin-stat"><span className="mono-label">DRAFTS</span><strong>{summary?.drafts ?? 0}</strong><span>Only visible to admins</span></article>
        <article className="admin-stat"><span className="mono-label">PUBLISHED</span><strong>{summary?.published ?? 0}</strong><span>Shown to public visitors</span></article>
        <article className={`admin-stat${summary?.warnings.length ? " admin-stat--alert" : ""}`}><span className="mono-label">ACTIONABLE WARNINGS</span><strong>{summary?.warnings.length ?? 0}</strong><span>Review before publishing</span></article>
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel__heading"><div><span className="mono-label">CATALOG / PRODUCTS</span><h2>Latest products</h2></div><Link className="text-link" href="/admin/products/new">Add <ArrowUpRight size={14} /></Link></div>
          {!products.data?.length ? <div className="admin-empty"><p>No products yet. Create a draft, add images and retailer links, then publish it.</p><Link className="button-outline" href="/admin/products/new"><Plus size={15} /> Create first product</Link></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Status</th><th>Updated</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{products.data.slice(0, 8).map((product) => <tr key={product.id}><td><Link href={`/admin/products/${product.id}`} className="table-product-link">{product.name || "Untitled product"}<span>/{product.slug}</span></Link></td><td>{product.category?.name ?? <span className="status-warning">Missing</span>}</td><td><span className={`status-pill status-pill--${product.status}`}>{product.status}{product.hasDraftChanges ? " · changes pending" : ""}</span></td><td>{displayDate(product.updatedAt)}</td><td><Link href={`/admin/products/${product.id}`} className="table-edit-link">Edit <ArrowUpRight size={13} /></Link></td></tr>)}</tbody></table></div>}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__heading"><div><span className="mono-label">CONTENT / REVIEW</span><h2>Needs attention</h2></div></div>
          {!summary?.warnings.length ? <p className="admin-empty-copy">No missing-field warnings on current products.</p> : <ul className="warning-list">{summary.warnings.slice(0, 8).map((warning) => <li key={warning.productId}><AlertTriangle size={16} aria-hidden="true" /><div><Link href={`/admin/products/${warning.productId}`}>{warning.name || "Untitled product"}</Link><span>{warning.issues.join(" · ")}</span></div><ArrowUpRight size={14} /></li>)}</ul>}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__heading"><div><span className="mono-label">HISTORY / LAST 10</span><h2>Recent edits</h2></div></div>
          {!summary?.recentEdits.length ? <p className="admin-empty-copy">Published and saved edits will appear here.</p> : <ul className="edit-history">{summary.recentEdits.map((edit) => <li key={edit.id}><div><strong>{edit.entityLabel}</strong><span>{edit.action} · {edit.editorEmail}</span></div><time dateTime={new Date(edit.createdAt).toISOString()}>{displayDate(edit.createdAt)}</time></li>)}</ul>}
        </section>

        <section className="admin-panel category-manager">
          <div className="admin-panel__heading"><div><span className="mono-label">TAXONOMY / CATEGORIES</span><h2>Manage categories</h2></div></div>
          <form className="inline-form" onSubmit={submitCategory}><label className="sr-only" htmlFor="new-category">New category name</label><input id="new-category" value={categoryName} onChange={(event) => { setCategoryName(event.target.value); setCategorySuccess(""); }} placeholder="e.g. Nightwear" maxLength={120} required /><button type="submit" className="button-outline" disabled={saveCategory.isPending}><Plus size={14} /> Add</button></form>
          {categoryError || saveCategory.error ? <p className="form-error" role="alert">{categoryError || saveCategory.error?.message}</p> : null}{categorySuccess ? <p className="form-success" role="status">{categorySuccess}</p> : null}
          <ul className="category-admin-list">{categories.data?.map((category) => <li key={category.id}><span>{category.name}<small>/{category.slug}{category.active ? "" : " · archived"}</small></span>{category.active ? <button className="icon-text-button" type="button" onClick={() => { if (window.confirm(`Archive ${category.name}? Existing product history is retained.`)) archiveCategory.mutate({ id: category.id }); }}><Archive size={14} /> Archive</button> : <button className="icon-text-button" type="button" onClick={() => saveCategory.mutate({ id: category.id, name: category.name, slug: category.slug, sortOrder: category.sortOrder })}><RefreshCw size={14} /> Reactivate</button>}</li>)}</ul>
          {archiveCategory.error ? <p className="form-error" role="alert">{archiveCategory.error.message}</p> : null}
          <p className="admin-footnote">Archived categories remain attached to existing product records. Reactivate them here before using them on new products.</p>
        </section>
      </div>
    </main>
  );
}
