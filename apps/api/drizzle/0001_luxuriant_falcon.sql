CREATE TABLE "day_close_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_close_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"cashier_name" varchar(255) NOT NULL,
	"opening_float" numeric(10, 2) NOT NULL,
	"closing_cash" numeric(10, 2) NOT NULL,
	"variance" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_closes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"operational_day_id" uuid NOT NULL,
	"operational_date" date NOT NULL,
	"day_close_number" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"completed_transactions" integer DEFAULT 0 NOT NULL,
	"voided_transactions" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cash_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"card_revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_refunds" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_discounts" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_variance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pending_transactions_at_close" integer DEFAULT 0 NOT NULL,
	"sync_status" varchar(20) DEFAULT 'clean' NOT NULL,
	"closed_by_user_id" uuid NOT NULL,
	"closed_by_user_name" varchar(255) NOT NULL,
	"closed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"device_name" varchar(255),
	"device_identifier" varchar(255) NOT NULL,
	"is_master_terminal" boolean DEFAULT false NOT NULL,
	"master_terminal_name" varchar(100),
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_identifier_unique" UNIQUE("device_identifier")
);
--> statement-breakpoint
CREATE TABLE "operational_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"operational_date" date NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"closed_by_user_id" uuid,
	"closed_by_user_name" varchar(255),
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_carts_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"cart_id" varchar(100) NOT NULL,
	"cart_data" text NOT NULL,
	"operational_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "operational_day_start_hour" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "allow_auto_day_transition" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "eod_notification_emails" text[];--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "operational_date" date;--> statement-breakpoint
ALTER TABLE "day_close_shifts" ADD CONSTRAINT "day_close_shifts_day_close_id_day_closes_id_fk" FOREIGN KEY ("day_close_id") REFERENCES "public"."day_closes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_close_shifts" ADD CONSTRAINT "day_close_shifts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_operational_day_id_operational_days_id_fk" FOREIGN KEY ("operational_day_id") REFERENCES "public"."operational_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_days" ADD CONSTRAINT "operational_days_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_carts_queue" ADD CONSTRAINT "pending_carts_queue_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_day_close_shifts_day_close" ON "day_close_shifts" USING btree ("day_close_id");--> statement-breakpoint
CREATE INDEX "idx_day_close_shifts_shift" ON "day_close_shifts" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_day_closes_store_date" ON "day_closes" USING btree ("store_id","operational_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_day_closes_number" ON "day_closes" USING btree ("day_close_number");--> statement-breakpoint
CREATE INDEX "idx_day_closes_date" ON "day_closes" USING btree ("operational_date");--> statement-breakpoint
CREATE INDEX "idx_devices_store" ON "devices" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_devices_identifier" ON "devices" USING btree ("device_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_operational_days_store_date" ON "operational_days" USING btree ("store_id","operational_date");--> statement-breakpoint
CREATE INDEX "idx_operational_days_date" ON "operational_days" USING btree ("operational_date");--> statement-breakpoint
CREATE INDEX "idx_pending_carts_store_date" ON "pending_carts_queue" USING btree ("store_id","operational_date");--> statement-breakpoint
CREATE INDEX "idx_pending_carts_expires" ON "pending_carts_queue" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_operational_date" ON "transactions" USING btree ("operational_date");