import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "./storage";
import {
  archiveCategory,
  archiveProduct,
  addProductImage,
  findPasswordResetToken,
  getAdminProduct,
  getAdminSitePage,
  getDashboardData,
  getPublishedPage,
  getPublishedProduct,
  hitAuthRateLimit,
  listActiveCategories,
  listAdminCategories,
  listAdminProducts,
  listPublishedProducts,
  publishProduct,
  publishSitePage,
  removeProductImage,
  saveCategory,
  saveProductDraft,
  saveSitePage,
  updateProductImageAlt,
  consumePasswordReset,
} from "./polina-db";
import { hashPassword, requestPasswordReset, sha256, signInWithPassword, signOut, validatePasswordRules } from "./_core/polina-auth";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import type { SiteContent } from "../drizzle/schema";
import { normalizeRetailerUrl } from "@shared/retailer";
import { normalizeInternalPath } from "@shared/internal-path";

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");
const idSchema = z.number().int().positive();
const optionalUrlSchema = z.string().trim().max(2048).nullable().optional();

function validatedRetailerLinks(input: { amazonUrl?: string | null; flipkartUrl?: string | null }) {
  const amazonUrl = normalizeRetailerUrl(input.amazonUrl, "amazon");
  const flipkartUrl = normalizeRetailerUrl(input.flipkartUrl, "flipkart");
  if (input.amazonUrl?.trim() && !amazonUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a secure HTTPS Amazon retailer link." });
  if (input.flipkartUrl?.trim() && !flipkartUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a secure HTTPS Flipkart retailer link." });
  return { amazonUrl, flipkartUrl };
}

function validateImageBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

const contentSchema = z.object({
  heroHeading: z.string().trim().min(1).max(120),
  heroDescription: z.string().trim().max(500),
  heroCtaLabel: z.string().trim().min(1).max(60),
  heroCtaTarget: z.string().trim().min(1).max(300),
  editorialHeading: z.string().trim().max(140),
  editorialBody: z.string().trim().max(1600),
  footerNote: z.string().trim().max(240),
  contactLinks: z.array(z.object({
    label: z.string().trim().min(1).max(40),
    href: z.string().trim().min(1).max(1000),
    icon: z.enum(["email", "instagram", "facebook", "linkedin", "twitter", "github", "discord", "other"]),
  })).max(12),
  featuredProductIds: z.array(idSchema).max(8).default([]).refine((ids) => new Set(ids).size === ids.length, "Select each featured product only once."),
}).strict();

function validateSiteContent(content: SiteContent) {
  const cta = content.heroCtaTarget.trim();
  if (!normalizeInternalPath(cta)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use an internal path for the hero call-to-action." });
  }
  for (const item of content.contactLinks) {
    if (item.href.startsWith("mailto:")) continue;
    if (item.href.startsWith("tel:")) continue;
    try {
      const url = new URL(item.href);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Use HTTPS, mailto:, or tel: for ${item.label}.` });
    }
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.admin ? ({ id: ctx.admin.id, name: ctx.admin.name, email: ctx.admin.email, role: "admin" as const }) : null),
    signIn: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      try {
        return await signInWithPassword(input, ctx.req, ctx.res);
      } catch (error) {
        if ((error as { code?: string }).code === "TOO_MANY_REQUESTS") {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again later." });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password was not accepted." });
      }
    }),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(({ input, ctx }) => requestPasswordReset(input.email, ctx.req)),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128) })).mutation(async ({ input }) => {
      const tokenHash = sha256(input.token);
      const resetToken = await findPasswordResetToken(tokenHash);
      if (!resetToken || !validatePasswordRules(input.password)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link is invalid or expired, or the password does not meet the requirements." });
      }
      await consumePasswordReset({ tokenHash, adminId: resetToken.adminId, passwordHash: await hashPassword(input.password) });
      return { success: true as const };
    }),
    logout: adminProcedure.mutation(({ ctx }) => signOut(ctx.req, ctx.res)),
  }),
  catalog: router({
    home: publicProcedure.query(() => getPublishedPage("home")),
    categories: publicProcedure.query(() => listActiveCategories()),
    products: publicProcedure.input(z.object({ categorySlug: z.string().trim().max(160).optional() }).optional()).query(({ input }) => listPublishedProducts(input?.categorySlug)),
    product: publicProcedure.input(z.object({ slug: z.string().trim().min(1).max(180) })).query(({ input }) => getPublishedProduct(input.slug)),
  }),
  admin: router({
    dashboard: adminProcedure.query(() => getDashboardData()),
    products: adminProcedure.query(() => listAdminProducts()),
    product: adminProcedure.input(z.object({ id: idSchema })).query(({ input }) => getAdminProduct(input.id)),
    categories: adminProcedure.query(() => listAdminCategories()),
    saveCategory: adminProcedure.input(z.object({ id: idSchema.optional(), name: z.string().trim().min(1).max(120), slug: slugSchema.max(160), sortOrder: z.number().int().min(0).max(10000) })).mutation(async ({ input }) => {
      if (input.id) {
        const category = (await listAdminCategories()).find((item) => item.id === input.id);
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
        if (category.slug !== input.slug && (await listPublishedProducts()).some((product) => product.categorySlug === category.slug)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unpublish or move the published products that use this category before changing its slug." });
        }
      }
      return saveCategory(input);
    }),
    archiveCategory: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ input }) => {
      const category = (await listAdminCategories()).find((item) => item.id === input.id);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
      if ((await listPublishedProducts()).some((product) => product.categorySlug === category.slug)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unpublish or move the published products in this category before archiving it." });
      }
      await archiveCategory(input.id);
      return { success: true as const };
    }),
    saveProduct: adminProcedure.input(z.object({
      id: idSchema.optional(),
      name: z.string().trim().min(1).max(200),
      slug: slugSchema,
      description: z.string().max(5000),
      categoryId: idSchema.nullable(),
      featured: z.boolean(),
      informationalOnly: z.boolean(),
      amazonUrl: optionalUrlSchema,
      flipkartUrl: optionalUrlSchema,
    })).mutation(({ input, ctx }) => {
      const retailerLinks = validatedRetailerLinks(input);
      return saveProductDraft({ ...input, ...retailerLinks, editor: ctx.admin! });
    }),
    publishProduct: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ input, ctx }) => {
      const product = await getAdminProduct(input.id);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      validatedRetailerLinks(product);
      await publishProduct(input.id, ctx.admin!);
      return { success: true as const };
    }),
    unpublishProduct: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ input, ctx }) => {
      await (await import("./polina-db")).unpublishProduct(input.id, ctx.admin!);
      return { success: true as const };
    }),
    archiveProduct: adminProcedure.input(z.object({ id: idSchema })).mutation(async ({ input, ctx }) => {
      await archiveProduct(input.id, ctx.admin!);
      return { success: true as const };
    }),
    uploadProductImage: adminProcedure.input(z.object({
      productId: idSchema,
      fileName: z.string().trim().min(1).max(180),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().min(1).max(7_500_000),
      altText: z.string().trim().min(2).max(400),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (buffer.length > 5 * 1024 * 1024 || !validateImageBytes(buffer, input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a valid JPEG, PNG, or WebP image up to 5 MB." });
      }
      const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
      const { key, url } = await storagePut(`polina/products/${input.productId}/${Date.now()}.${extension}`, buffer, input.mimeType);
      const imageId = await addProductImage({ productId: input.productId, storageKey: key, url, altText: input.altText.trim(), sortOrder: Date.now() });
      return { id: imageId, storageKey: key, url, altText: input.altText.trim() };
    }),
    updateProductImage: adminProcedure.input(z.object({ productId: idSchema, imageId: idSchema, altText: z.string().trim().min(2).max(400), sortOrder: z.number().int().min(0).max(100000) })).mutation(({ input }) => updateProductImageAlt(input)),
    removeProductImage: adminProcedure.input(z.object({ productId: idSchema, imageId: idSchema })).mutation(({ input }) => removeProductImage(input.productId, input.imageId)),
    sitePage: adminProcedure.input(z.object({ pageKey: z.literal("home") })).query(({ input }) => getAdminSitePage(input.pageKey)),
    saveSitePage: adminProcedure.input(z.object({ pageKey: z.literal("home"), content: contentSchema })).mutation(({ input, ctx }) => {
      validateSiteContent(input.content);
      return saveSitePage({ ...input, editor: ctx.admin! });
    }),
    publishSitePage: adminProcedure.input(z.object({ pageKey: z.literal("home") })).mutation(async ({ input, ctx }) => {
      await publishSitePage(input.pageKey, ctx.admin!);
      return { success: true as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
