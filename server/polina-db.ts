import { and, asc, desc, eq, gt, isNull, ne } from "drizzle-orm";
import {
  adminAccounts,
  adminSessions,
  authRateLimits,
  categories,
  contentEdits,
  passwordResetTokens,
  productImages,
  products,
  sitePages,
  type AdminAccount,
  type PublishedProductSnapshot,
  type SiteContent,
} from "../drizzle/schema";
import { getDb } from "./db";
import { normalizeRetailerUrl } from "@shared/retailer";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function findAdminByEmail(email: string) {
  const db = await requireDb();
  const [row] = await db.select().from(adminAccounts).where(eq(adminAccounts.email, email)).limit(1);
  return row ?? null;
}

export async function findAdminById(id: number) {
  const db = await requireDb();
  const [row] = await db.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1);
  return row ?? null;
}

export async function createAdminAccount(input: { email: string; name: string | null; passwordHash: string }) {
  const db = await requireDb();
  const result = await db.insert(adminAccounts).values({
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    active: true,
  });
  const insertId = Number((result[0] as { insertId?: number }).insertId);
  if (!Number.isInteger(insertId) || insertId < 1) throw new Error("Admin account was not created");
  return insertId;
}

export async function updateAdminLastSignedIn(id: number) {
  const db = await requireDb();
  await db.update(adminAccounts).set({ lastSignedIn: new Date() }).where(eq(adminAccounts.id, id));
}

export async function createAdminSession(input: {
  adminId: number;
  tokenHash: string;
  csrfHash: string;
  expiresAt: Date;
}) {
  const db = await requireDb();
  await db.insert(adminSessions).values(input);
}

export async function findAdminForSession(tokenHash: string) {
  const db = await requireDb();
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      sessionTokenHash: adminSessions.tokenHash,
      csrfHash: adminSessions.csrfHash,
      expiresAt: adminSessions.expiresAt,
      admin: adminAccounts,
    })
    .from(adminSessions)
    .innerJoin(adminAccounts, eq(adminSessions.adminId, adminAccounts.id))
    .where(and(
      eq(adminSessions.tokenHash, tokenHash),
      isNull(adminSessions.revokedAt),
      gt(adminSessions.expiresAt, now),
      eq(adminAccounts.active, true),
    ))
    .limit(1);
  return row ?? null;
}

export async function revokeAdminSession(tokenHash: string) {
  const db = await requireDb();
  await db.update(adminSessions).set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt)));
}

export async function revokeAllAdminSessions(adminId: number) {
  const db = await requireDb();
  await db.update(adminSessions).set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.adminId, adminId), isNull(adminSessions.revokedAt)));
}

export async function createPasswordResetToken(input: { adminId: number; tokenHash: string; expiresAt: Date }) {
  const db = await requireDb();
  await db.insert(passwordResetTokens).values(input);
}

export async function findPasswordResetToken(tokenHash: string) {
  const db = await requireDb();
  const now = new Date();
  const [row] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, tokenHash),
    isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, now),
  )).limit(1);
  return row ?? null;
}

export async function consumePasswordReset(input: { tokenHash: string; adminId: number; passwordHash: string }) {
  const db = await requireDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    const [token] = await tx.select().from(passwordResetTokens).where(and(
      eq(passwordResetTokens.tokenHash, input.tokenHash),
      eq(passwordResetTokens.adminId, input.adminId),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    )).limit(1);
    if (!token) throw new Error("This password reset link is invalid or expired.");
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, token.id));
    await tx.update(adminAccounts).set({ passwordHash: input.passwordHash, updatedAt: now })
      .where(eq(adminAccounts.id, input.adminId));
    await tx.update(adminSessions).set({ revokedAt: now })
      .where(and(eq(adminSessions.adminId, input.adminId), isNull(adminSessions.revokedAt)));
  });
}

export async function hitAuthRateLimit(input: {
  bucketKey: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
}) {
  const db = await requireDb();
  const now = new Date();
  const [row] = await db.select().from(authRateLimits).where(eq(authRateLimits.bucketKey, input.bucketKey)).limit(1);
  if (!row) {
    await db.insert(authRateLimits).values({ bucketKey: input.bucketKey, attempts: 1, windowStartedAt: now });
    return { limited: false, retryAfterMs: 0 };
  }
  if (row.blockedUntil && row.blockedUntil > now) {
    return { limited: true, retryAfterMs: row.blockedUntil.getTime() - now.getTime() };
  }
  const inWindow = now.getTime() - row.windowStartedAt.getTime() < input.windowMs;
  const attempts = inWindow ? row.attempts + 1 : 1;
  const blockedUntil = attempts > input.maxAttempts ? new Date(now.getTime() + input.blockMs) : null;
  await db.update(authRateLimits).set({
    attempts,
    windowStartedAt: inWindow ? row.windowStartedAt : now,
    blockedUntil,
  }).where(eq(authRateLimits.bucketKey, input.bucketKey));
  return blockedUntil
    ? { limited: true, retryAfterMs: input.blockMs }
    : { limited: false, retryAfterMs: 0 };
}

export async function clearAuthRateLimit(bucketKey: string) {
  const db = await requireDb();
  await db.delete(authRateLimits).where(eq(authRateLimits.bucketKey, bucketKey));
}

export async function listActiveCategories() {
  const db = await requireDb();
  return db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listAdminCategories() {
  const db = await requireDb();
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function saveCategory(input: { id?: number; name: string; slug: string; sortOrder: number }) {
  const db = await requireDb();
  const existingSlug = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.slug)).limit(1);
  if (existingSlug[0] && existingSlug[0].id !== input.id) throw new Error("That category slug is already in use.");
  if (input.id) {
    await db.update(categories).set({ name: input.name, slug: input.slug, sortOrder: input.sortOrder, active: true })
      .where(eq(categories.id, input.id));
    return input.id;
  }
  const result = await db.insert(categories).values({ name: input.name, slug: input.slug, sortOrder: input.sortOrder, active: true });
  return Number((result[0] as { insertId?: number }).insertId);
}

export async function archiveCategory(id: number) {
  const db = await requireDb();
  await db.update(categories).set({ active: false }).where(eq(categories.id, id));
}

export async function listPublishedProducts(categorySlug?: string) {
  const db = await requireDb();
  const rows = await db.select().from(products).where(eq(products.status, "published"))
    .orderBy(desc(products.featured), desc(products.publishedAt));
  return rows
    .filter((row) => Boolean(row.publishedData) && (!categorySlug || row.publishedData?.categorySlug === categorySlug))
    .map((row) => ({ id: row.id, ...row.publishedData!, publishedAt: row.publishedAt }));
}

export async function getPublishedProduct(slug: string) {
  const db = await requireDb();
  const [row] = await db.select().from(products).where(and(
    eq(products.status, "published"),
    eq(products.publishedSlug, slug),
  )).limit(1);
  return row?.publishedData ? { id: row.id, ...row.publishedData, publishedAt: row.publishedAt } : null;
}

export async function getPublishedPage(pageKey: string) {
  const db = await requireDb();
  const [row] = await db.select().from(sitePages).where(eq(sitePages.pageKey, pageKey)).limit(1);
  return row?.publishedContent ?? null;
}

async function getProductImages(productId: number) {
  const db = await requireDb();
  return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder), asc(productImages.id));
}

export async function getAdminProduct(id: number) {
  const db = await requireDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const images = await getProductImages(id);
  const [category] = product.categoryId
    ? await db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1)
    : [];
  return { ...product, images, category: category ?? null };
}

export async function listAdminProducts() {
  const db = await requireDb();
  const rows = await db.select().from(products).where(ne(products.status, "archived")).orderBy(desc(products.updatedAt));
  const result = [];
  for (const product of rows) {
    const [category] = product.categoryId
      ? await db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1)
      : [];
    const images = await getProductImages(product.id);
    result.push({ ...product, category: category ?? null, images });
  }
  return result;
}

export async function saveProductDraft(input: {
  id?: number;
  name: string;
  slug: string;
  description: string;
  categoryId: number | null;
  featured: boolean;
  informationalOnly: boolean;
  amazonUrl: string | null;
  flipkartUrl: string | null;
  editor: AdminAccount;
}) {
  const db = await requireDb();
  const [slugOwner] = await db.select({ id: products.id }).from(products).where(eq(products.slug, input.slug)).limit(1);
  if (slugOwner && slugOwner.id !== input.id) throw new Error("That product slug is already in use.");
  const now = new Date();
  let id = input.id;
  if (id) {
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current || current.status === "archived") throw new Error("Product not found.");
    await db.update(products).set({
      name: input.name,
      slug: input.slug,
      description: input.description,
      categoryId: input.categoryId,
      featured: input.featured,
      informationalOnly: input.informationalOnly,
      amazonUrl: input.amazonUrl,
      flipkartUrl: input.flipkartUrl,
      status: current.status === "published" ? "published" : "draft",
      hasDraftChanges: current.status === "published",
      updatedBy: input.editor.id,
      updatedAt: now,
    }).where(eq(products.id, id));
  } else {
    const result = await db.insert(products).values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      categoryId: input.categoryId,
      featured: input.featured,
      informationalOnly: input.informationalOnly,
      amazonUrl: input.amazonUrl,
      flipkartUrl: input.flipkartUrl,
      status: "draft",
      hasDraftChanges: false,
      createdBy: input.editor.id,
      updatedBy: input.editor.id,
    });
    id = Number((result[0] as { insertId?: number }).insertId);
  }
  if (!id) throw new Error("Product could not be saved.");
  await recordEdit({ entityType: "product", entityId: String(id), entityLabel: input.name, action: "saved draft", editorEmail: input.editor.email });
  return id;
}

export async function addProductImage(input: {
  productId: number;
  storageKey: string;
  url: string;
  altText: string;
  sortOrder: number;
}) {
  const db = await requireDb();
  const [product] = await db.select({ id: products.id, status: products.status }).from(products).where(eq(products.id, input.productId)).limit(1);
  if (!product || product.status === "archived") throw new Error("Product not found.");
  const result = await db.insert(productImages).values(input);
  const imageId = Number((result[0] as { insertId?: number }).insertId);
  if (product.status === "published") {
    await db.update(products).set({ hasDraftChanges: true, updatedAt: new Date() }).where(eq(products.id, input.productId));
  }
  return imageId;
}

export async function updateProductImageAlt(input: { productId: number; imageId: number; altText: string; sortOrder: number }) {
  const db = await requireDb();
  const result = await db.update(productImages).set({ altText: input.altText, sortOrder: input.sortOrder })
    .where(and(eq(productImages.id, input.imageId), eq(productImages.productId, input.productId)));
  if (Number((result as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) {
    const [exists] = await db.select({ id: productImages.id }).from(productImages)
      .where(and(eq(productImages.id, input.imageId), eq(productImages.productId, input.productId))).limit(1);
    if (!exists) throw new Error("Image not found for this product.");
  }
  await db.update(products).set({ hasDraftChanges: true, updatedAt: new Date() }).where(eq(products.id, input.productId));
}

export async function removeProductImage(productId: number, imageId: number) {
  const db = await requireDb();
  await db.delete(productImages).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
  await db.update(products).set({ hasDraftChanges: true, updatedAt: new Date() }).where(eq(products.id, productId));
}

export async function publishProduct(id: number, editor: AdminAccount) {
  const db = await requireDb();
  const product = await getAdminProduct(id);
  if (!product || product.status === "archived") throw new Error("Product not found.");
  const category = product.category;
  if (!product.name.trim() || !product.slug.trim() || !category?.active || !product.images.length) {
    throw new Error("Add a name, unique slug, category, and at least one image before publishing.");
  }
  if (product.images.some((image) => !image.altText.trim())) throw new Error("Add descriptive alt text to every product image before publishing.");
  if (!product.informationalOnly && !product.amazonUrl && !product.flipkartUrl) {
    throw new Error("Add a valid Amazon or Flipkart link, or mark this product as informational only.");
  }
  const snapshot: PublishedProductSnapshot = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: category.id,
    categoryName: category.name,
    categorySlug: category.slug,
    featured: product.featured,
    informationalOnly: product.informationalOnly,
    amazonUrl: product.amazonUrl,
    flipkartUrl: product.flipkartUrl,
    images: product.images.map((image) => ({ url: image.url, altText: image.altText })),
  };
  const now = new Date();
  await db.update(products).set({
    status: "published",
    publishedSlug: product.slug,
    publishedData: snapshot,
    hasDraftChanges: false,
    publishedAt: now,
    updatedBy: editor.id,
    updatedAt: now,
  }).where(eq(products.id, id));
  await recordEdit({ entityType: "product", entityId: String(id), entityLabel: product.name, action: "published", editorEmail: editor.email });
}

export async function unpublishProduct(id: number, editor: AdminAccount) {
  const db = await requireDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product || product.status === "archived") throw new Error("Product not found.");
  await db.update(products).set({ status: "draft", publishedSlug: null, publishedData: null, hasDraftChanges: false, publishedAt: null, updatedBy: editor.id, updatedAt: new Date() }).where(eq(products.id, id));
  await recordEdit({ entityType: "product", entityId: String(id), entityLabel: product.name, action: "unpublished", editorEmail: editor.email });
}

export async function archiveProduct(id: number, editor: AdminAccount) {
  const db = await requireDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) throw new Error("Product not found.");
  await db.update(products).set({ status: "archived", publishedSlug: null, publishedData: null, hasDraftChanges: false, publishedAt: null, updatedBy: editor.id, updatedAt: new Date() }).where(eq(products.id, id));
  await recordEdit({ entityType: "product", entityId: String(id), entityLabel: product.name, action: "archived", editorEmail: editor.email });
}

export async function getAdminSitePage(pageKey: string) {
  const db = await requireDb();
  const [row] = await db.select().from(sitePages).where(eq(sitePages.pageKey, pageKey)).limit(1);
  return row ?? null;
}

export async function saveSitePage(input: { pageKey: string; content: SiteContent; editor: AdminAccount }) {
  const db = await requireDb();
  const [current] = await db.select().from(sitePages).where(eq(sitePages.pageKey, input.pageKey)).limit(1);
  const now = new Date();
  if (current) {
    await db.update(sitePages).set({
      draftContent: input.content,
      version: current.version + 1,
      status: current.publishedContent ? "published" : "draft",
      updatedBy: input.editor.id,
      updatedAt: now,
    }).where(eq(sitePages.id, current.id));
    await recordEdit({ entityType: "page", entityId: input.pageKey, entityLabel: input.pageKey, action: "saved draft", editorEmail: input.editor.email });
    return;
  }
  await db.insert(sitePages).values({
    pageKey: input.pageKey,
    draftContent: input.content,
    publishedContent: null,
    status: "draft",
    version: 1,
    updatedBy: input.editor.id,
  });
  await recordEdit({ entityType: "page", entityId: input.pageKey, entityLabel: input.pageKey, action: "saved draft", editorEmail: input.editor.email });
}

export async function publishSitePage(pageKey: string, editor: AdminAccount) {
  const db = await requireDb();
  const [page] = await db.select().from(sitePages).where(eq(sitePages.pageKey, pageKey)).limit(1);
  if (!page) throw new Error("Save page content before publishing.");
  const now = new Date();
  await db.update(sitePages).set({ publishedContent: page.draftContent, status: "published", publishedAt: now, updatedBy: editor.id, updatedAt: now }).where(eq(sitePages.id, page.id));
  await recordEdit({ entityType: "page", entityId: pageKey, entityLabel: pageKey, action: "published", editorEmail: editor.email });
}

export async function getDashboardData() {
  const db = await requireDb();
  const [allProducts, recentEdits, allCategories] = await Promise.all([
    db.select().from(products).where(ne(products.status, "archived")),
    db.select().from(contentEdits).orderBy(desc(contentEdits.createdAt)).limit(10),
    db.select().from(categories),
  ]);
  const categoryById = new Map(allCategories.map((category) => [category.id, category]));
  const slugCounts = new Map<string, number>();
  for (const product of allProducts) {
    const slug = product.slug.trim().toLowerCase();
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }
  const warnings: Array<{ productId: number; name: string; slug: string; issues: string[] }> = [];
  for (const product of allProducts) {
    const issues: string[] = [];
    if (!product.name.trim()) issues.push("Missing name");
    if (!product.slug.trim()) issues.push("Missing slug");
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) issues.push("Invalid slug");
    if ((slugCounts.get(product.slug.trim().toLowerCase()) ?? 0) > 1) issues.push("Duplicate slug");
    const category = product.categoryId ? categoryById.get(product.categoryId) : null;
    if (!category || !category.active) issues.push(category ? "Inactive category" : "Missing category");
    const images = await getProductImages(product.id);
    if (!images.length) issues.push("Missing image");
    if (images.some((image) => !image.altText.trim())) issues.push("Missing image alt text");
    if (product.amazonUrl && !normalizeRetailerUrl(product.amazonUrl, "amazon")) issues.push("Invalid Amazon URL");
    if (product.flipkartUrl && !normalizeRetailerUrl(product.flipkartUrl, "flipkart")) issues.push("Invalid Flipkart URL");
    if (!product.amazonUrl && !product.flipkartUrl && !product.informationalOnly) issues.push("Missing retailer link");
    if (issues.length) warnings.push({ productId: product.id, name: product.name, slug: product.slug, issues });
  }
  return {
    total: allProducts.length,
    drafts: allProducts.filter((row) => row.status === "draft").length,
    published: allProducts.filter((row) => row.status === "published").length,
    recentEdits,
    warnings,
  };
}

async function recordEdit(input: {
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: string;
  editorEmail: string;
}) {
  const db = await requireDb();
  await db.insert(contentEdits).values(input);
}
