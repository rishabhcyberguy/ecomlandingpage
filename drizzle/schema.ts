import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Starter Manus OAuth identity table. POLINA email/password administrators are stored separately. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const adminAccounts = mysqlTable("polina_admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 160 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export const adminSessions = mysqlTable(
  "polina_admin_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    adminId: int("adminId").notNull().references(() => adminAccounts.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    csrfHash: varchar("csrfHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  (table) => [uniqueIndex("polina_admin_sessions_token_uq").on(table.tokenHash)],
);

export const passwordResetTokens = mysqlTable(
  "polina_password_reset_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    adminId: int("adminId").notNull().references(() => adminAccounts.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
  },
  (table) => [uniqueIndex("polina_reset_tokens_token_uq").on(table.tokenHash)],
);

export const authRateLimits = mysqlTable("polina_auth_rate_limits", {
  bucketKey: varchar("bucketKey", { length: 128 }).primaryKey(),
  attempts: int("attempts").default(0).notNull(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  blockedUntil: timestamp("blockedUntil"),
});

export const categories = mysqlTable("polina_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductImageSnapshot = {
  url: string;
  altText: string;
};

export type PublishedProductSnapshot = {
  name: string;
  slug: string;
  description: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  featured: boolean;
  informationalOnly: boolean;
  amazonUrl: string | null;
  flipkartUrl: string | null;
  images: ProductImageSnapshot[];
};

export const products = mysqlTable(
  "polina_products",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    description: text("description").notNull(),
    categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
    featured: boolean("featured").default(false).notNull(),
    informationalOnly: boolean("informationalOnly").default(false).notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    hasDraftChanges: boolean("hasDraftChanges").default(false).notNull(),
    publishedSlug: varchar("publishedSlug", { length: 180 }),
    publishedData: json("publishedData").$type<PublishedProductSnapshot | null>(),
    amazonUrl: text("amazonUrl"),
    flipkartUrl: text("flipkartUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    createdBy: int("createdBy").references(() => adminAccounts.id, { onDelete: "set null" }),
    updatedBy: int("updatedBy").references(() => adminAccounts.id, { onDelete: "set null" }),
    publishedAt: timestamp("publishedAt"),
  },
  (table) => [uniqueIndex("polina_products_published_slug_uq").on(table.publishedSlug)],
);

export const productImages = mysqlTable("polina_product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  altText: varchar("altText", { length: 400 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SiteContent = {
  heroHeading: string;
  heroDescription: string;
  heroCtaLabel: string;
  heroCtaTarget: string;
  editorialHeading: string;
  editorialBody: string;
  footerNote: string;
  contactLinks: Array<{ label: string; href: string; icon: string }>;
  featuredProductIds?: number[];
};

export const sitePages = mysqlTable("polina_site_pages", {
  id: int("id").autoincrement().primaryKey(),
  pageKey: varchar("pageKey", { length: 64 }).notNull().unique(),
  draftContent: json("draftContent").$type<SiteContent>().notNull(),
  publishedContent: json("publishedContent").$type<SiteContent | null>(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  version: int("version").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy").references(() => adminAccounts.id, { onDelete: "set null" }),
  publishedAt: timestamp("publishedAt"),
});

export const contentEdits = mysqlTable("polina_content_edits", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 40 }).notNull(),
  entityId: varchar("entityId", { length: 80 }).notNull(),
  entityLabel: varchar("entityLabel", { length: 200 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  editorEmail: varchar("editorEmail", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAccount = typeof adminAccounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type SitePage = typeof sitePages.$inferSelect;
