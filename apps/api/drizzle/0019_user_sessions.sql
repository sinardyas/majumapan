-- Migration: Create user_sessions table
-- Created to support device binding login system

CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"device_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"pin_hash" varchar NOT NULL,
	"is_active" boolean NOT NULL DEFAULT true,
	"pin_failed_attempts" integer NOT NULL DEFAULT 0,
	"pin_locked_until" timestamp,
	"last_active_at" timestamp,
	"last_pin_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);

CREATE INDEX "user_sessions_user_idx" ON "user_sessions"("user_id");
CREATE INDEX "user_sessions_device_idx" ON "user_sessions"("device_id");
CREATE INDEX "user_sessions_is_active_idx" ON "user_sessions"("is_active");
