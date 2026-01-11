CREATE TYPE "public"."shift_status" AS ENUM('ACTIVE', 'CLOSED', 'SUSPENDED');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'supervisor' BEFORE 'cashier';--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_number" varchar(50) NOT NULL,
	"cashier_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'ACTIVE' NOT NULL,
	"opening_float" numeric(10, 2) NOT NULL,
	"opening_note" text,
	"opening_image_url" text,
	"opening_timestamp" timestamp DEFAULT now() NOT NULL,
	"ending_cash" numeric(10, 2),
	"ending_note" text,
	"closing_timestamp" timestamp,
	"variance" numeric(10, 2),
	"variance_reason" text,
	"variance_approved_by" uuid,
	"variance_approved_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"server_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_shift_number_unique" UNIQUE("shift_number")
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_variance_approved_by_users_id_fk" FOREIGN KEY ("variance_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shifts_cashier_status" ON "shifts" USING btree ("cashier_id","status");--> statement-breakpoint
CREATE INDEX "idx_shifts_store_status" ON "shifts" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "idx_shifts_shift_number" ON "shifts" USING btree ("shift_number");--> statement-breakpoint
CREATE INDEX "idx_shifts_opening_timestamp" ON "shifts" USING btree ("opening_timestamp");