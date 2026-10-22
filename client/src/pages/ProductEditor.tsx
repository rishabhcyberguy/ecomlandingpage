import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Archive, Eye, ImagePlus, Save, Send, Trash2 } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/components/PolinaLayout";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { normalizeRetailerUrl } from "@shared/retailer";
import { trackUploadProgress } from "@/lib/upload-progress";

function slugify(value: string) {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  featured: boolean;
  informationalOnly: boolean;
  amazonUrl: string;
  flipkartUrl: string;
};

const BLANK_PRODUCT: ProductForm = { name: "", slug: "", description: "", categoryId: "", featured: false, informationalOnly: false, amazonUrl: "", flipkartUrl: "" };

async function fileAsBase64(file: File, onProgress?: (percent: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("Could not encode that image."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductEditorPage() {
  const [, params] = useRoute("/admin/products/:id");
  const rawId = params?.id ?? "new";
  const productId = rawId === "new" ? undefined : Number(rawId);
  const isValidId = productId !== undefined && Number.isInteger(productId) && productId > 0;
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const productQuery = trpc.admin.product.useQuery({ id: isValidId ? productId! : 1 }, { enabled: Boolean(isValidId) });
  const categoriesQuery = trpc.admin.categories.useQuery();
  const [form, setForm] = useState<ProductForm>(BLANK_PRODUCT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [altText, setAltText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const save = trpc.admin.saveProduct.useMutation();
  const publish = trpc.admin.publishProduct.useMutation();
  const unpublish = trpc.admin.unpublishProduct.useMutation();
  const archive = trpc.admin.archiveProduct.useMutation();
  const upload = trpc.admin.uploadProductImage.useMutation();
  const updateImage = trpc.admin.updateProductImage.useMutation();
  const removeImage = trpc.admin.removeProductImage.useMutation();
  const product = productQuery.data;
  usePageMeta(product ? `${product.name} — Product editor` : "Product editor — POLINA", "Edit POLINA product catalog data.", true);
  useUnsavedChangesGuard(dirty);
  useEffect(() => {
    if (rawId !== "new" && !isValidId) setLocation("/admin");
  }, [rawId, isValidId, setLocation]);

  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId ? String(product.categoryId) : "",
      featured: product.featured,
      informationalOnly: product.informationalOnly,
      amazonUrl: product.amazonUrl ?? "",
      flipkartUrl: product.flipkartUrl ?? "",
    });
    setDirty(false);
  }, [product]);

  const updateField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setDirty(true);
    setNotice("");
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const saveDraft = async (event?: FormEvent) => {
    event?.preventDefault();
    setLocalError("");
    setNotice("");
    try {
      const id = await save.mutateAsync({
        ...(isValidId ? { id: productId! } : {}),
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        featured: form.featured,
        informationalOnly: form.informationalOnly,
        amazonUrl: form.amazonUrl.trim() || null,
        flipkartUrl: form.flipkartUrl.trim() || null,
      });
      setDirty(false);
      setNotice("Draft saved. Public content remains unchanged until you publish.");
      await Promise.all([utils.admin.products.invalidate(), utils.admin.dashboard.invalidate()]);
      if (!isValidId) setLocation(`/admin/products/${id}`);
      else await utils.admin.product.invalidate({ id: productId! });
      return id;
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The product could not be saved.");
      return null;
    }
  };

  const handlePublish = async () => {
    if (!isValidId) {
      setLocalError("Save the draft before publishing.");
      return;
    }
    setLocalError("");
    try {
      if (dirty && !(await saveDraft())) return;
      await publish.mutateAsync({ id: productId! });
      setNotice("Product published. Public shoppers can now see the published version.");
      await Promise.all([utils.admin.product.invalidate({ id: productId! }), utils.admin.products.invalidate(), utils.admin.dashboard.invalidate()]);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The product could not be published.");
    }
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");
    if (!isValidId || !imageFile) {
      setLocalError("Save the product draft before uploading an image.");
      return;
    }
    if (imageFile.size > 3 * 1024 * 1024) {
      setLocalError("Images must be 3 MiB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
      setLocalError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (altText.trim().length < 2) {
      setLocalError("Add descriptive alt text before uploading.");
      return;
    }
    let stopTrackingUpload = () => {};
    try {
      setImagePreparing(true);
      setFileReadProgress(0);
      setUploadProgress(null);
      const base64 = await fileAsBase64(imageFile, setFileReadProgress);
      setImagePreparing(false);
      stopTrackingUpload = trackUploadProgress(({ loaded, total }) => {
        setUploadProgress(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null);
      });
      await upload.mutateAsync({ productId: productId!, fileName: imageFile.name, mimeType: imageFile.type as "image/jpeg" | "image/png" | "image/webp", base64, altText: altText.trim() });
      setImageFile(null);
      setAltText("");
      setNotice("Image uploaded and attached to the draft.");
      await Promise.all([utils.admin.product.invalidate({ id: productId! }), utils.admin.products.invalidate(), utils.admin.dashboard.invalidate()]);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The image upload failed.");
    } finally {
      stopTrackingUpload();
      setImagePreparing(false);
      setUploadProgress(null);
    }
  };

  const status = product?.status ?? "draft";
  const images = product?.images ?? [];
  const submitPublishLabel = publish.isPending ? "Publishing…" : "Publish product";

  if (rawId !== "new" && !isValidId) {
    return <main className="admin-content"><div className="admin-alert admin-alert--error" role="alert">That product address is invalid.</div><Link className="back-link" href="/admin"><ArrowLeft size={14} /> Return to dashboard</Link></main>;
  }

  return (
    <main className="admin-content">
      <div className="admin-page-heading">
        <div><Link className="back-link" href="/admin"><ArrowLeft size={14} /> Dashboard</Link><span className="mono-label">CATALOG / PRODUCT EDITOR</span><h1>{isValidId ? "Edit product" : "New product"}<span className="red-dot">.</span></h1><p>Changes to published items stay in draft until you publish.</p></div>
        <div className="admin-heading-actions">{isValidId && product ? <Link className="button-outline" href={`/admin/products/${productId}/preview`}><Eye size={15} /> Preview draft</Link> : null}<button className="button-outline" type="button" onClick={() => void saveDraft()} disabled={save.isPending || (isValidId && (productQuery.isLoading || Boolean(productQuery.error)))}><Save size={15} /> {save.isPending ? "Saving…" : "Save draft"}</button></div>
      </div>

      {isValidId && productQuery.isLoading ? <div className="admin-panel">Loading product…</div> : null}
      {isValidId && productQuery.error ? <div className="admin-alert admin-alert--error" role="alert">Product could not be loaded: {productQuery.error.message}</div> : null}
      {product ? <div className="product-editor-status"><span className={`status-pill status-pill--${status}`}>{status}{product.hasDraftChanges ? " · draft changes pending" : ""}</span><span>Created {new Date(product.createdAt).toLocaleDateString()} · Updated {new Date(product.updatedAt).toLocaleString()}</span>{product.updatedBy ? <span>Editor ID {product.updatedBy}</span> : null}</div> : null}
      {localError || save.error || upload.error || publish.error ? <div className="admin-alert admin-alert--error" role="alert">{localError || save.error?.message || upload.error?.message || publish.error?.message}</div> : null}
      {notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}

      {(!isValidId || (!productQuery.isLoading && !productQuery.error)) ? <form className="admin-editor-grid" onSubmit={(event) => void saveDraft(event)}>
        <section className="admin-panel product-editor-main">
          <div className="admin-panel__heading"><div><span className="mono-label">PRODUCT DETAILS</span><h2>Catalog entry</h2></div></div>
          <div className="admin-form admin-form--grid">
            <label className="field-span-2">Product name<input required maxLength={200} value={form.name} onChange={(event) => { const name = event.target.value; updateField("name", name); if (!slugTouched) setForm((previous) => ({ ...previous, slug: slugify(name) })); }} /></label>
            <label className="field-span-2">Public slug<div className="slug-field"><span>/products/</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={180} value={form.slug} onChange={(event) => { setSlugTouched(true); updateField("slug", slugify(event.target.value)); }} /></div><small>Lowercase letters, numbers, and hyphens. Changing a published slug changes the public URL after the next publish.</small></label>
            {product?.status === "published" && product.publishedSlug && form.slug !== product.publishedSlug ? <p className="form-warning field-span-2" role="alert">Publishing this slug will change the public URL from /products/{product.publishedSlug}. The old URL will no longer resolve; update saved retailer or campaign links before publishing.</p> : null}
            <label>Category<select required value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}><option value="">Choose a category</option>{categoriesQuery.data?.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small><Link href="/admin">Manage categories</Link> on the dashboard.</small></label>
            <label>Display setting<select value={form.featured ? "featured" : "standard"} onChange={(event) => updateField("featured", event.target.value === "featured")}><option value="standard">Standard</option><option value="featured">Featured on homepage</option></select></label>
            <label className="field-span-2">Description<textarea maxLength={5000} rows={6} value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Plain text product description" /></label>
            <div className="field-span-2 check-field"><input id="informational-only" type="checkbox" checked={form.informationalOnly} onChange={(event) => updateField("informationalOnly", event.target.checked)} /><label htmlFor="informational-only">This is an informational/editorial item without a retailer purchase link.</label></div>
          </div>
        </section>

        <section className="admin-panel product-editor-side">
          <div className="admin-panel__heading"><div><span className="mono-label">PUBLISHING</span><h2>Retailer links</h2></div></div>
          <div className="admin-form">
            <label>Amazon URL<input type="url" inputMode="url" value={form.amazonUrl} onChange={(event) => updateField("amazonUrl", event.target.value)} placeholder="https://www.amazon.in/..." maxLength={2048} /><small>HTTPS Amazon domains only.</small></label>
            <label>Flipkart URL<input type="url" inputMode="url" value={form.flipkartUrl} onChange={(event) => updateField("flipkartUrl", event.target.value)} placeholder="https://www.flipkart.com/..." maxLength={2048} /><small>HTTPS Flipkart links only.</small></label>
          </div>
          <div className="publish-rules"><span className="mono-label">BEFORE PUBLISHING</span><ul><li>Name, unique slug, and category</li><li>At least one image with descriptive alt text</li><li>One valid retailer link, unless marked informational</li></ul></div>
          <div className="editor-actions"><button type="button" className="button-red button-red--wide" onClick={() => void handlePublish()} disabled={!isValidId || !product || publish.isPending || save.isPending}>{submitPublishLabel}<Send size={15} /></button>
            {status === "published" ? <button type="button" className="button-outline button-outline--wide" onClick={async () => { if (!window.confirm(dirty ? "Save your draft changes, then unpublish this product? It will disappear from public pages while the saved draft remains in admin." : "Unpublish this product? It will disappear from public pages and remain as a draft.")) return; if (dirty && !(await saveDraft())) return; try { await unpublish.mutateAsync({ id: productId! }); setNotice("Product unpublished; it is no longer visible to public visitors."); await Promise.all([utils.admin.product.invalidate({ id: productId! }), utils.admin.products.invalidate(), utils.admin.dashboard.invalidate()]); } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not unpublish."); } }} disabled={unpublish.isPending || save.isPending}>Unpublish</button> : null}
            {product ? <button type="button" className="archive-button" onClick={async () => { if (!window.confirm(dirty ? "Save your draft changes, then archive this product? It will leave public lists, and its product history will be retained." : "Archive this product? It will leave public lists. Product history is retained.")) return; if (dirty && !(await saveDraft())) return; try { await archive.mutateAsync({ id: productId! }); await utils.admin.dashboard.invalidate(); setLocation("/admin"); } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not archive."); } }} disabled={archive.isPending || save.isPending}><Archive size={14} /> Archive product</button> : null}
          </div>
        </section>

        <section className="admin-panel image-editor field-span-2">
          <div className="admin-panel__heading"><div><span className="mono-label">MEDIA / ALT TEXT REQUIRED</span><h2>Product images <small>({images.length})</small></h2></div><span className="admin-footnote">JPEG, PNG, or WebP · max 3 MiB each</span></div>
          {images.length ? <div className="image-admin-grid">{images.map((image, index) => <article className="image-admin-card" key={image.id}><img src={image.url} alt={image.altText} loading="lazy" /><label>Alt text<input defaultValue={image.altText} maxLength={400} minLength={2} onBlur={(event) => { const nextText = event.target.value.trim(); if (nextText && nextText !== image.altText && isValidId) updateImage.mutate({ productId: productId!, imageId: image.id, altText: nextText, sortOrder: index }, { onSuccess: () => { setNotice("Image alt text saved."); void Promise.all([utils.admin.product.invalidate({ id: productId! }), utils.admin.dashboard.invalidate()]); } }); }} /></label><button type="button" className="icon-text-button icon-text-button--danger" onClick={() => { if (window.confirm("Remove this image from the product? The stored asset itself is retained.")) removeImage.mutate({ productId: productId!, imageId: image.id }, { onSuccess: () => { setNotice("Image removed from product."); void Promise.all([utils.admin.product.invalidate({ id: productId! }), utils.admin.dashboard.invalidate()]); } }); }}><Trash2 size={14} /> Remove</button></article>)}</div> : <p className="admin-empty-copy">No product images yet. Save the product, then upload at least one image before publishing.</p>}
          <form className="upload-row" onSubmit={(event) => void handleUpload(event)}>
            <label className="upload-file-label"><ImagePlus size={16} /> Choose image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} disabled={!isValidId} /></label>
            <span className="upload-file-name">{imageFile?.name ?? (isValidId ? "No file selected" : "Save the draft to enable uploads")}</span>
            <label className="upload-alt-label">Describe the image<input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={400} minLength={2} placeholder="e.g. Black satin nightdress on a model" required /></label>
            <button type="submit" className="button-outline" disabled={!isValidId || !imageFile || upload.isPending || imagePreparing}>{imagePreparing ? `Preparing ${fileReadProgress}%…` : upload.isPending ? uploadProgress === null ? "Uploading…" : uploadProgress >= 100 ? "Saving image…" : `Uploading ${uploadProgress}%…` : "Upload image"}</button>
          </form>
          {imagePreparing || upload.isPending ? <div className={`upload-progress${upload.isPending && uploadProgress === null ? " upload-progress--indeterminate" : ""}`} role="progressbar" aria-label={imagePreparing ? "Preparing image file" : "Uploading product request bytes"} aria-valuemin={imagePreparing || uploadProgress !== null ? 0 : undefined} aria-valuemax={imagePreparing || uploadProgress !== null ? 100 : undefined} aria-valuenow={imagePreparing ? fileReadProgress : uploadProgress ?? undefined} aria-valuetext={imagePreparing ? `Preparing ${fileReadProgress}%` : uploadProgress === null ? "Uploading; the browser has not provided a byte total" : uploadProgress >= 100 ? "Image request sent; waiting for secure storage to finish" : `Uploaded ${uploadProgress}% of the image request body`}><span aria-hidden="true" style={imagePreparing ? { width: `${Math.max(fileReadProgress, 2)}%` } : uploadProgress !== null ? { width: `${uploadProgress}%` } : undefined} /></div> : null}
          {updateImage.error || removeImage.error ? <p className="form-error" role="alert">{updateImage.error?.message || removeImage.error?.message}</p> : null}
        </section>
      </form> : null}
      <div className="admin-bottom-note"><Link href="/admin" className="back-link"><ArrowLeft size={14} /> Return to dashboard</Link>{product?.status === "published" && product.publishedSlug ? <Link href={`/products/${encodeURIComponent(product.publishedSlug)}`} className="text-link">View current public URL <ArrowUpRight size={14} /></Link> : isValidId ? <span className="admin-footnote">Public URL is available after publishing.</span> : null}</div>
    </main>
  );
}

export function ProductPreviewPage() {
  const [, params] = useRoute("/admin/products/:id/preview");
  const id = Number(params?.id);
  const validId = Number.isInteger(id) && id > 0;
  const productQuery = trpc.admin.product.useQuery({ id: validId ? id : 1 }, { enabled: validId });
  const product = productQuery.data;
  usePageMeta(product ? `Preview: ${product.name} — POLINA` : "Product preview — POLINA", "Private preview of a POLINA product draft.", true);
  const amazon = normalizeRetailerUrl(product?.amazonUrl ?? null, "amazon");
  const flipkart = normalizeRetailerUrl(product?.flipkartUrl ?? null, "flipkart");
  return (
    <main className="admin-content">
      <div className="admin-page-heading"><div><span className="mono-label">PREVIEW / ADMIN ONLY · NOT PUBLIC</span><h1>Product preview<span className="red-dot">.</span></h1><p>This uses the current editor data. It is not indexed or visible to shoppers.</p></div><Link href={`/admin/products/${id}`} className="button-outline"><ArrowLeft size={15} /> Back to editor</Link></div>
      {productQuery.isLoading ? <p>Loading preview…</p> : product ? <article className="draft-preview">
        <div className="draft-preview__gallery">{product.images.map((image) => <img key={image.id} src={image.url} alt={image.altText} />)}{!product.images.length ? <div className="product-image-empty">IMAGE PENDING</div> : null}</div>
        <div className="draft-preview__copy"><span className="mono-label">{product.category?.name ?? "CATEGORY PENDING"} / DRAFT PREVIEW</span><h2>{product.name || "Product name pending"}</h2><p>{product.description || "Description pending."}</p>
          <div className="retailer-actions">
            {amazon ? <a className="button-red" href={amazon} target="_blank" rel="noopener noreferrer">Shop on Amazon <ArrowUpRight size={14} /></a> : null}
            {flipkart ? <a className="button-outline" href={flipkart} target="_blank" rel="noopener noreferrer">Shop on Flipkart <ArrowUpRight size={14} /></a> : null}
            {!amazon && !flipkart && product.informationalOnly ? <span className="product-info-only">Informational item</span> : null}
          </div>
        </div>
      </article> : <div className="admin-alert admin-alert--error">This product was not found.</div>}
    </main>
  );
}
