CREATE TYPE voucher_type AS ENUM ('GC', 'PR');
CREATE TYPE voucher_discount_type AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_ITEM');
CREATE TYPE voucher_scope AS ENUM ('ENTIRE_ORDER', 'ITEMS_ONLY', 'SUBTOTAL', 'SPECIFIC_ITEMS');
CREATE TYPE voucher_free_item_mode AS ENUM ('AUTO_ADD', 'QUALIFY_FIRST');
CREATE TYPE voucher_qualifier_type AS ENUM ('CATEGORY', 'PRODUCT', 'BOTH');
CREATE TYPE voucher_item_type AS ENUM ('CATEGORY', 'PRODUCT');
CREATE TYPE voucher_transaction_type AS ENUM ('usage', 'refund', 'adjustment', 'void', 'create');

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(19) NOT NULL,
	"type" voucher_type NOT NULL,
	"discount_type" voucher_discount_type,
	"initial_value" numeric(12, 2),
	"current_balance" numeric(12, 2),
	"currency" varchar(3) NOT NULL DEFAULT 'IDR',
	"percentage_value" numeric(5, 2),
	"fixed_value" numeric(12, 2),
	"scope" voucher_scope,
	"free_item_id" uuid,
	"free_item_mode" voucher_free_item_mode,
	"min_purchase" numeric(12, 2),
	"max_discount" numeric(12, 2),
	"expires_at" timestamp with time zone,
	"is_active" boolean NOT NULL DEFAULT true,
	"is_void" boolean NOT NULL DEFAULT false,
	"customer_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"notes" text
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON "vouchers" ("code");
CREATE INDEX IF NOT EXISTS idx_vouchers_customer ON "vouchers" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_vouchers_expires ON "vouchers" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_active ON "vouchers" ("is_active", "is_void");
CREATE INDEX IF NOT EXISTS idx_vouchers_type ON "vouchers" ("type");

CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_code_unique ON "vouchers" ("code");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "voucher_applicable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"voucher_id" uuid NOT NULL REFERENCES "vouchers"("id") ON DELETE CASCADE,
	"item_type" voucher_item_type NOT NULL,
	"item_id" uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voucher_applicable_voucher ON "voucher_applicable_items" ("voucher_id");
CREATE INDEX IF NOT EXISTS idx_voucher_applicable_item ON "voucher_applicable_items" ("item_type", "item_id");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "voucher_qualifier_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"voucher_id" uuid NOT NULL REFERENCES "vouchers"("id") ON DELETE CASCADE,
	"qualifier_type" voucher_qualifier_type NOT NULL,
	"item_type" voucher_item_type NOT NULL,
	"item_id" uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voucher_qualifier_voucher ON "voucher_qualifier_items" ("voucher_id");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "voucher_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"voucher_id" uuid NOT NULL REFERENCES "vouchers"("id"),
	"type" voucher_transaction_type NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"order_id" uuid,
	"created_by" uuid,
	"balance_before" numeric(12, 2),
	"balance_after" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_transactions_voucher ON "voucher_transactions" ("voucher_id");
CREATE INDEX IF NOT EXISTS idx_voucher_transactions_order ON "voucher_transactions" ("order_id");
CREATE INDEX IF NOT EXISTS idx_voucher_transactions_created ON "voucher_transactions" ("created_at");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "order_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
	"voucher_id" uuid NOT NULL REFERENCES "vouchers"("id"),
	"amount_applied" numeric(12, 2) NOT NULL,
	"discount_details" jsonb,
	"type" voucher_type NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_vouchers_order ON "order_vouchers" ("order_id");
CREATE INDEX IF NOT EXISTS idx_order_vouchers_voucher ON "order_vouchers" ("voucher_id");
