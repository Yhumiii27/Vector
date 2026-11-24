CREATE TABLE "vector"."app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_name" text NOT NULL,
	CONSTRAINT "app_settings_key_check" CHECK ("vector"."app_settings"."key" ~ '^[a-z][a-z0-9_.-]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "vector"."audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text NOT NULL,
	"actor_role" text,
	"object_ref" text NOT NULL,
	"change" text NOT NULL,
	"area" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	CONSTRAINT "audit_entries_text_check" CHECK (btrim("vector"."audit_entries"."actor_name") <> '' and btrim("vector"."audit_entries"."object_ref") <> '' and btrim("vector"."audit_entries"."change") <> '' and btrim("vector"."audit_entries"."area") <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."counters" (
	"prefix" text NOT NULL,
	"year" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "counters_prefix_year_pk" PRIMARY KEY("prefix","year"),
	CONSTRAINT "counters_prefix_check" CHECK ("vector"."counters"."prefix" in ('SR', 'SH', 'RFQ', 'INC')),
	CONSTRAINT "counters_values_check" CHECK ("vector"."counters"."year" between 2000 and 2999 and "vector"."counters"."value" between 0 and 9999)
);
--> statement-breakpoint
CREATE TABLE "vector"."job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"lease_until" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	CONSTRAINT "job_runs_status_check" CHECK ("vector"."job_runs"."last_status" is null or "vector"."job_runs"."last_status" in ('ok', 'error'))
);
--> statement-breakpoint
CREATE TABLE "vector"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oid" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "users_oid_unique" UNIQUE("oid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_check" CHECK ("vector"."users"."email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and "vector"."users"."email" = lower("vector"."users"."email")),
	CONSTRAINT "users_name_check" CHECK (btrim("vector"."users"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."bookings" (
	"shipment_id" uuid PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"number" text NOT NULL,
	"vessel" text,
	"voyage" text,
	"master_document" text,
	"house_document" text,
	"docs_cutoff" timestamp with time zone,
	"vgm_cutoff" timestamp with time zone,
	"cargo_cutoff" timestamp with time zone,
	"etd" date,
	"eta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_number_check" CHECK (btrim("vector"."bookings"."number") <> ''),
	CONSTRAINT "bookings_dates_check" CHECK ("vector"."bookings"."etd" is null or "vector"."bookings"."eta" is null or "vector"."bookings"."etd" <= "vector"."bookings"."eta"),
	CONSTRAINT "bookings_cutoffs_check" CHECK ("vector"."bookings"."docs_cutoff" is null or "vector"."bookings"."cargo_cutoff" is null or "vector"."bookings"."docs_cutoff" <= "vector"."bookings"."cargo_cutoff" + interval '7 days')
);
--> statement-breakpoint
CREATE TABLE "vector"."compliance_checks" (
	"shipment_id" uuid NOT NULL,
	"check" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"detail" text,
	"evidence_codex_ref" text,
	"reason" text,
	"by_name" text,
	"at" timestamp with time zone,
	CONSTRAINT "compliance_checks_shipment_id_check_pk" PRIMARY KEY("shipment_id","check"),
	CONSTRAINT "compliance_check_check" CHECK ("vector"."compliance_checks"."check" in ('destination', 'screening', 'dual_use', 'dangerous_goods', 'end_use')),
	CONSTRAINT "compliance_state_check" CHECK ("vector"."compliance_checks"."state" in ('pending', 'ok', 'na', 'blocked', 'waived')),
	CONSTRAINT "compliance_reason_check" CHECK ("vector"."compliance_checks"."state" <> 'waived' or btrim(coalesce("vector"."compliance_checks"."reason", '')) <> ''),
	CONSTRAINT "compliance_by_check" CHECK ("vector"."compliance_checks"."state" = 'pending' or ("vector"."compliance_checks"."by_name" is not null and "vector"."compliance_checks"."at" is not null))
);
--> statement-breakpoint
CREATE TABLE "vector"."cost_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"category" text NOT NULL,
	"partner_id" uuid,
	"currency" text NOT NULL,
	"estimated" numeric(14, 2),
	"quoted" numeric(14, 2),
	"invoiced" numeric(14, 2),
	"invoice_number" text,
	"invoice_date" date,
	"reconciled" boolean DEFAULT false NOT NULL,
	"variance_reason" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "costs_category_check" CHECK ("vector"."cost_lines"."category" in ('freight', 'surcharges', 'port_handling', 'customs', 'duties_taxes', 'insurance', 'packing', 'storage', 'demurrage', 'detention', 'other')),
	CONSTRAINT "costs_currency_check" CHECK ("vector"."cost_lines"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "costs_amounts_check" CHECK (coalesce("vector"."cost_lines"."estimated", 0) >= 0 and coalesce("vector"."cost_lines"."quoted", 0) >= 0 and coalesce("vector"."cost_lines"."invoiced", 0) >= 0),
	CONSTRAINT "costs_some_check" CHECK ("vector"."cost_lines"."estimated" is not null or "vector"."cost_lines"."quoted" is not null or "vector"."cost_lines"."invoiced" is not null),
	CONSTRAINT "costs_invoice_check" CHECK (("vector"."cost_lines"."invoiced" is null) = ("vector"."cost_lines"."invoice_date" is null) and ("vector"."cost_lines"."invoiced" is null or btrim(coalesce("vector"."cost_lines"."invoice_number", '')) <> '')),
	CONSTRAINT "costs_reconciled_check" CHECK (not "vector"."cost_lines"."reconciled" or "vector"."cost_lines"."invoiced" is not null),
	CONSTRAINT "costs_source_check" CHECK ("vector"."cost_lines"."source" in ('manual', 'quote', 'sage', 'estimate'))
);
--> statement-breakpoint
CREATE TABLE "vector"."cost_standards" (
	"mode" text NOT NULL,
	"zone" text NOT NULL,
	"eur_per_kg" numeric(10, 3) NOT NULL,
	CONSTRAINT "cost_standards_mode_zone_pk" PRIMARY KEY("mode","zone"),
	CONSTRAINT "cost_standards_mode_check" CHECK ("vector"."cost_standards"."mode" in ('road', 'sea', 'air', 'rail', 'express', 'multimodal')),
	CONSTRAINT "cost_standards_zone_check" CHECK ("vector"."cost_standards"."zone" in ('europe', 'africa', 'americas', 'asia', 'oceania', 'middle_east')),
	CONSTRAINT "cost_standards_value_check" CHECK ("vector"."cost_standards"."eur_per_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "vector"."countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"eu" boolean DEFAULT false NOT NULL,
	"zone" text NOT NULL,
	"risk" text DEFAULT 'none' NOT NULL,
	"origin_document" text DEFAULT 'none' NOT NULL,
	"note" text,
	CONSTRAINT "countries_code_check" CHECK ("vector"."countries"."code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "countries_name_check" CHECK (btrim("vector"."countries"."name") <> ''),
	CONSTRAINT "countries_zone_check" CHECK ("vector"."countries"."zone" in ('europe', 'africa', 'americas', 'asia', 'oceania', 'middle_east')),
	CONSTRAINT "countries_risk_check" CHECK ("vector"."countries"."risk" in ('none', 'watch', 'restricted', 'embargoed')),
	CONSTRAINT "countries_origin_check" CHECK ("vector"."countries"."origin_document" in ('none', 'eur1', 'certificate'))
);
--> statement-breakpoint
CREATE TABLE "vector"."customs_declarations" (
	"shipment_id" uuid PRIMARY KEY NOT NULL,
	"procedure" text NOT NULL,
	"declarant_id" uuid,
	"mrn" text,
	"lodged_on" date,
	"exit_on" date,
	"exit_codex_ref" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customs_procedure_check" CHECK ("vector"."customs_declarations"."procedure" in ('export', 'temporary_export', 're_export', 'outward_processing', 'intra_eu', 'domestic')),
	CONSTRAINT "customs_mrn_check" CHECK ("vector"."customs_declarations"."mrn" is null or "vector"."customs_declarations"."mrn" ~ '^[0-9]{2}[A-Z]{2}[A-Z0-9]{13}[0-9]$'),
	CONSTRAINT "customs_exit_check" CHECK ("vector"."customs_declarations"."exit_on" is null or ("vector"."customs_declarations"."mrn" is not null and ("vector"."customs_declarations"."lodged_on" is null or "vector"."customs_declarations"."lodged_on" <= "vector"."customs_declarations"."exit_on")))
);
--> statement-breakpoint
CREATE TABLE "vector"."exchange_rates" (
	"currency" text NOT NULL,
	"on" date NOT NULL,
	"per_eur" numeric(14, 6) NOT NULL,
	CONSTRAINT "exchange_rates_currency_on_pk" PRIMARY KEY("currency","on"),
	CONSTRAINT "exchange_rates_currency_check" CHECK ("vector"."exchange_rates"."currency" ~ '^[A-Z]{3}$' and "vector"."exchange_rates"."currency" <> 'EUR'),
	CONSTRAINT "exchange_rates_rate_check" CHECK ("vector"."exchange_rates"."per_eur" > 0)
);
--> statement-breakpoint
CREATE TABLE "vector"."hs_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"dual_use_code" text,
	"validated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hs_codes_code_check" CHECK ("vector"."hs_codes"."code" ~ '^[0-9]{6,10}$'),
	CONSTRAINT "hs_codes_description_check" CHECK (btrim("vector"."hs_codes"."description") <> ''),
	CONSTRAINT "hs_codes_dual_use_check" CHECK ("vector"."hs_codes"."dual_use_code" is null or "vector"."hs_codes"."dual_use_code" ~ '^[0-9][A-E][0-9]{3}[a-z0-9.]*$')
);
--> statement-breakpoint
CREATE TABLE "vector"."incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"shipment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"occurred_on" date NOT NULL,
	"place" text,
	"description" text NOT NULL,
	"reserves_written" boolean DEFAULT false NOT NULL,
	"photos_codex_ref" text,
	"partner_id" uuid,
	"claimed_amount" numeric(14, 2),
	"claim_currency" text,
	"claim_sent_on" date,
	"recovered_amount" numeric(14, 2),
	"state" text DEFAULT 'open' NOT NULL,
	"state_reason" text,
	"reported_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_ref_unique" UNIQUE("ref"),
	CONSTRAINT "incidents_ref_check" CHECK ("vector"."incidents"."ref" ~ '^INC-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "incidents_type_check" CHECK ("vector"."incidents"."type" in ('delay', 'damage', 'loss', 'shortage', 'customs_hold', 'documents', 'safety', 'other')),
	CONSTRAINT "incidents_severity_check" CHECK ("vector"."incidents"."severity" in ('minor', 'major', 'critical')),
	CONSTRAINT "incidents_description_check" CHECK (btrim("vector"."incidents"."description") <> ''),
	CONSTRAINT "incidents_state_check" CHECK ("vector"."incidents"."state" in ('open', 'claimed', 'settled', 'rejected', 'closed')),
	CONSTRAINT "incidents_claim_check" CHECK (("vector"."incidents"."claimed_amount" is null or ("vector"."incidents"."claimed_amount" >= 0 and "vector"."incidents"."claim_currency" ~ '^[A-Z]{3}$')) and coalesce("vector"."incidents"."recovered_amount", 0) >= 0),
	CONSTRAINT "incidents_claimed_check" CHECK ("vector"."incidents"."state" not in ('claimed', 'settled', 'rejected') or ("vector"."incidents"."claimed_amount" is not null and "vector"."incidents"."claim_sent_on" is not null)),
	CONSTRAINT "incidents_reason_check" CHECK ("vector"."incidents"."state" <> 'closed' or btrim(coalesce("vector"."incidents"."state_reason", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."incoterms" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sea_only" boolean NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "incoterms_code_check" CHECK ("vector"."incoterms"."code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "incoterms_name_check" CHECK (btrim("vector"."incoterms"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"type" text NOT NULL,
	"identifier" text,
	"seal" text,
	CONSTRAINT "loads_number_unique" UNIQUE("shipment_id","number"),
	CONSTRAINT "loads_number_check" CHECK ("vector"."loads"."number" > 0),
	CONSTRAINT "loads_type_check" CHECK ("vector"."loads"."type" in ('truck', 'c20', 'c40', 'c40hc', 'open_top', 'flat_rack', 'hold', 'deck', 'uld')),
	CONSTRAINT "loads_container_check" CHECK ("vector"."loads"."type" not in ('c20', 'c40', 'c40hc', 'open_top', 'flat_rack') or "vector"."loads"."identifier" is null or "vector"."loads"."identifier" ~ '^[A-Z]{4}[0-9]{7}$')
);
--> statement-breakpoint
CREATE TABLE "vector"."milestones" (
	"shipment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"planned_on" date,
	"actual_on" date,
	"place" text,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_shipment_id_code_pk" PRIMARY KEY("shipment_id","code"),
	CONSTRAINT "milestones_code_check" CHECK ("vector"."milestones"."code" in ('ready', 'pickup', 'export_cleared', 'gate_in', 'loaded', 'departed', 'transshipment', 'arrived', 'import_cleared', 'out_for_delivery', 'delivered')),
	CONSTRAINT "milestones_source_check" CHECK ("vector"."milestones"."source" in ('manual', 'tracking')),
	CONSTRAINT "milestones_dates_check" CHECK ("vector"."milestones"."planned_on" is not null or "vector"."milestones"."actual_on" is not null)
);
--> statement-breakpoint
CREATE TABLE "vector"."outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"kind" text NOT NULL,
	"shipment_id" uuid,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"result_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "outbox_target_check" CHECK ("vector"."outbox"."target" in ('codex', 'vigie', 'mail', 'keystone')),
	CONSTRAINT "outbox_kind_check" CHECK ("vector"."outbox"."kind" ~ '^[a-z_]{2,40}$'),
	CONSTRAINT "outbox_state_check" CHECK ("vector"."outbox"."state" in ('pending', 'sent', 'failed')),
	CONSTRAINT "outbox_sent_check" CHECK (("vector"."outbox"."state" = 'sent') = ("vector"."outbox"."sent_at" is not null) and "vector"."outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vector"."package_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"part_ref" text,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text DEFAULT 'pc' NOT NULL,
	"hs_code" text,
	"origin_country" text,
	"unit_value" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"net_kg" numeric(10, 1),
	"order_ref" text,
	"dual_use_code" text,
	"un_number" text,
	"dg_class" text,
	"dg_packing_group" text,
	CONSTRAINT "lines_description_check" CHECK (btrim("vector"."package_lines"."description") <> ''),
	CONSTRAINT "lines_quantity_check" CHECK ("vector"."package_lines"."quantity" > 0),
	CONSTRAINT "lines_unit_check" CHECK ("vector"."package_lines"."unit" in ('pc', 'set', 'kg', 'm', 'l')),
	CONSTRAINT "lines_hs_check" CHECK ("vector"."package_lines"."hs_code" is null or "vector"."package_lines"."hs_code" ~ '^[0-9]{6,10}$'),
	CONSTRAINT "lines_origin_check" CHECK ("vector"."package_lines"."origin_country" is null or "vector"."package_lines"."origin_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "lines_value_check" CHECK ("vector"."package_lines"."unit_value" >= 0 and "vector"."package_lines"."currency" ~ '^[A-Z]{3}$' and coalesce("vector"."package_lines"."net_kg", 1) > 0),
	CONSTRAINT "lines_dual_use_check" CHECK ("vector"."package_lines"."dual_use_code" is null or "vector"."package_lines"."dual_use_code" ~ '^[0-9][A-E][0-9]{3}[a-z0-9.]*$'),
	CONSTRAINT "lines_dg_check" CHECK (("vector"."package_lines"."un_number" is null and "vector"."package_lines"."dg_class" is null and "vector"."package_lines"."dg_packing_group" is null) or ("vector"."package_lines"."un_number" ~ '^UN[0-9]{4}$' and "vector"."package_lines"."dg_class" ~ '^[1-9](\.[1-6])?$' and ("vector"."package_lines"."dg_packing_group" is null or "vector"."package_lines"."dg_packing_group" in ('I', 'II', 'III'))))
);
--> statement-breakpoint
CREATE TABLE "vector"."packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"load_id" uuid,
	"number" integer NOT NULL,
	"type" text NOT NULL,
	"length_cm" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"height_cm" integer NOT NULL,
	"gross_kg" numeric(10, 1) NOT NULL,
	"net_kg" numeric(10, 1) NOT NULL,
	"stackable" boolean DEFAULT true NOT NULL,
	"packaging_code" text,
	"description" text NOT NULL,
	"photos_codex_ref" text,
	CONSTRAINT "packages_number_unique" UNIQUE("shipment_id","number"),
	CONSTRAINT "packages_number_check" CHECK ("vector"."packages"."number" > 0),
	CONSTRAINT "packages_type_check" CHECK ("vector"."packages"."type" in ('crate', 'box', 'pallet', 'skid', 'drum', 'bundle', 'unit', 'container', 'envelope')),
	CONSTRAINT "packages_dims_check" CHECK ("vector"."packages"."length_cm" between 1 and 5000 and "vector"."packages"."width_cm" between 1 and 2000 and "vector"."packages"."height_cm" between 1 and 2000),
	CONSTRAINT "packages_weights_check" CHECK ("vector"."packages"."net_kg" > 0 and "vector"."packages"."net_kg" <= "vector"."packages"."gross_kg" and "vector"."packages"."gross_kg" <= 500000),
	CONSTRAINT "packages_description_check" CHECK (btrim("vector"."packages"."description") <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."packaging_standards" (
	"code" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"length_cm" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"height_cm" integer NOT NULL,
	"tare_kg" numeric(10, 1) NOT NULL,
	"max_kg" numeric(10, 1) NOT NULL,
	"norm" text,
	CONSTRAINT "packaging_code_check" CHECK ("vector"."packaging_standards"."code" ~ '^[A-Z0-9-]{2,20}$'),
	CONSTRAINT "packaging_type_check" CHECK ("vector"."packaging_standards"."type" in ('crate', 'box', 'pallet', 'skid', 'drum', 'bundle', 'unit', 'container', 'envelope')),
	CONSTRAINT "packaging_dims_check" CHECK ("vector"."packaging_standards"."length_cm" > 0 and "vector"."packaging_standards"."width_cm" > 0 and "vector"."packaging_standards"."height_cm" > 0 and "vector"."packaging_standards"."tare_kg" >= 0 and "vector"."packaging_standards"."max_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "vector"."partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"country" text NOT NULL,
	"modes" text[] NOT NULL,
	"zones" text[] NOT NULL,
	"accreditations" text,
	"contact_role" text,
	"contact_email" text,
	"contact_phone" text,
	"state" text DEFAULT 'active' NOT NULL,
	"state_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_name_unique" UNIQUE("name"),
	CONSTRAINT "partners_name_check" CHECK (btrim("vector"."partners"."name") <> ''),
	CONSTRAINT "partners_kind_check" CHECK ("vector"."partners"."kind" in ('carrier', 'forwarder', 'express', 'packer', 'insurer', 'agent', 'customs_broker')),
	CONSTRAINT "partners_country_check" CHECK ("vector"."partners"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "partners_modes_check" CHECK (cardinality("vector"."partners"."modes") > 0 and "vector"."partners"."modes" <@ array['road','sea','air','rail','express','multimodal']::text[]),
	CONSTRAINT "partners_zones_check" CHECK ("vector"."partners"."zones" <@ array['europe','africa','americas','asia','oceania','middle_east']::text[]),
	CONSTRAINT "partners_state_check" CHECK ("vector"."partners"."state" in ('active', 'suspended', 'archived')),
	CONSTRAINT "partners_reason_check" CHECK ("vector"."partners"."state" = 'active' or btrim(coalesce("vector"."partners"."state_reason", '')) <> ''),
	CONSTRAINT "partners_email_check" CHECK ("vector"."partners"."contact_email" is null or "vector"."partners"."contact_email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
--> statement-breakpoint
CREATE TABLE "vector"."quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transit_days" integer NOT NULL,
	"departure_on" date,
	"valid_until" date NOT NULL,
	"conditions" text,
	"codex_ref" text,
	"state" text DEFAULT 'received' NOT NULL,
	"award_reason" text,
	"awarded_at" timestamp with time zone,
	"awarded_by_name" text,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quotes_partner_unique" UNIQUE("rfq_id","partner_id"),
	CONSTRAINT "quotes_amount_check" CHECK ("vector"."quotes"."amount" >= 0 and "vector"."quotes"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "quotes_transit_check" CHECK ("vector"."quotes"."transit_days" between 0 and 365),
	CONSTRAINT "quotes_state_check" CHECK ("vector"."quotes"."state" in ('received', 'awarded', 'declined', 'expired')),
	CONSTRAINT "quotes_awarded_check" CHECK (("vector"."quotes"."state" = 'awarded') = ("vector"."quotes"."awarded_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "vector"."rfq_invitations" (
	"rfq_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"invited_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone,
	"declined" boolean DEFAULT false NOT NULL,
	CONSTRAINT "rfq_invitations_rfq_id_partner_id_pk" PRIMARY KEY("rfq_id","partner_id"),
	CONSTRAINT "invitations_answer_check" CHECK ("vector"."rfq_invitations"."answered_at" is null or "vector"."rfq_invitations"."answered_at" >= "vector"."rfq_invitations"."invited_at")
);
--> statement-breakpoint
CREATE TABLE "vector"."rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"shipment_id" uuid NOT NULL,
	"scope" text DEFAULT 'door_to_door' NOT NULL,
	"due_on" date NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rfqs_ref_unique" UNIQUE("ref"),
	CONSTRAINT "rfqs_ref_check" CHECK ("vector"."rfqs"."ref" ~ '^RFQ-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "rfqs_scope_check" CHECK ("vector"."rfqs"."scope" in ('door_to_door', 'pre_carriage', 'main_carriage', 'on_carriage')),
	CONSTRAINT "rfqs_state_check" CHECK ("vector"."rfqs"."state" in ('draft', 'sent', 'closed', 'cancelled')),
	CONSTRAINT "rfqs_sent_check" CHECK ("vector"."rfqs"."state" = 'draft' or "vector"."rfqs"."state" = 'cancelled' or "vector"."rfqs"."sent_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "vector"."shipment_allocations" (
	"shipment_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"share" numeric(5, 4),
	"share_reason" text,
	CONSTRAINT "shipment_allocations_shipment_id_request_id_pk" PRIMARY KEY("shipment_id","request_id"),
	CONSTRAINT "allocations_share_check" CHECK ("vector"."shipment_allocations"."share" is null or ("vector"."shipment_allocations"."share" >= 0 and "vector"."shipment_allocations"."share" <= 1 and btrim(coalesce("vector"."shipment_allocations"."share_reason", '')) <> ''))
);
--> statement-breakpoint
CREATE TABLE "vector"."shipment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'expected' NOT NULL,
	"number" text,
	"issued_on" date,
	"codex_ref" text,
	"generated" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_name" text NOT NULL,
	CONSTRAINT "documents_kind_unique" UNIQUE("shipment_id","kind"),
	CONSTRAINT "documents_kind_check" CHECK ("vector"."shipment_documents"."kind" in ('packing_list', 'proforma_invoice', 'commercial_invoice', 'marks', 'shipping_instructions', 'cmr', 'bill_of_lading', 'air_waybill', 'export_declaration', 'certificate_of_origin', 'eur1', 'insurance_certificate', 'dg_declaration', 'sds', 'dual_use_licence', 'end_use_certificate', 'ispm15', 'vgm', 'pod', 'lc_documents')),
	CONSTRAINT "documents_state_check" CHECK ("vector"."shipment_documents"."state" in ('expected', 'received', 'checked', 'rejected', 'waived')),
	CONSTRAINT "documents_reference_check" CHECK ("vector"."shipment_documents"."state" not in ('received', 'checked') or btrim(coalesce("vector"."shipment_documents"."codex_ref", '')) <> ''),
	CONSTRAINT "documents_reason_check" CHECK ("vector"."shipment_documents"."state" not in ('waived', 'rejected') or btrim(coalesce("vector"."shipment_documents"."reason", '')) <> ''),
	CONSTRAINT "documents_codex_check" CHECK ("vector"."shipment_documents"."codex_ref" is null or "vector"."shipment_documents"."codex_ref" ~ '^[A-Z]{2,5}-[A-Z0-9-]{1,40}$')
);
--> statement-breakpoint
CREATE TABLE "vector"."shipment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"origin" text NOT NULL,
	"title" text NOT NULL,
	"project_code" text,
	"cost_code" text,
	"order_ref" text,
	"from_site" text,
	"from_address" text,
	"from_country" text NOT NULL,
	"to_site" text,
	"to_address" text,
	"to_country" text NOT NULL,
	"ready_on" date NOT NULL,
	"needed_on" date NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"description" text NOT NULL,
	"estimated_kg" numeric(12, 1),
	"estimated_m3" numeric(10, 3),
	"estimated_value_eur" numeric(14, 2),
	"dangerous_goods" text DEFAULT 'unknown' NOT NULL,
	"incoterm" text,
	"incoterm_place" text,
	"state" text DEFAULT 'draft' NOT NULL,
	"state_reason" text,
	"requested_by_id" uuid NOT NULL,
	"requested_by_name" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_requests_ref_unique" UNIQUE("ref"),
	CONSTRAINT "requests_ref_check" CHECK ("vector"."shipment_requests"."ref" ~ '^SR-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "requests_origin_check" CHECK ("vector"."shipment_requests"."origin" in ('project', 'purchase_order', 'spare_part', 'site_return', 'other')),
	CONSTRAINT "requests_title_check" CHECK (btrim("vector"."shipment_requests"."title") <> ''),
	CONSTRAINT "requests_description_check" CHECK (btrim("vector"."shipment_requests"."description") <> ''),
	CONSTRAINT "requests_imputation_check" CHECK ("vector"."shipment_requests"."project_code" is not null or "vector"."shipment_requests"."cost_code" is not null),
	CONSTRAINT "requests_project_check" CHECK ("vector"."shipment_requests"."project_code" is null or "vector"."shipment_requests"."project_code" ~ '^[A-Z0-9-]{2,20}$'),
	CONSTRAINT "requests_cost_code_check" CHECK ("vector"."shipment_requests"."cost_code" is null or "vector"."shipment_requests"."cost_code" ~ '^[A-Z0-9-]{2,20}$'),
	CONSTRAINT "requests_from_check" CHECK ("vector"."shipment_requests"."from_site" is not null or btrim(coalesce("vector"."shipment_requests"."from_address", '')) <> ''),
	CONSTRAINT "requests_to_check" CHECK ("vector"."shipment_requests"."to_site" is not null or btrim(coalesce("vector"."shipment_requests"."to_address", '')) <> ''),
	CONSTRAINT "requests_countries_check" CHECK ("vector"."shipment_requests"."from_country" ~ '^[A-Z]{2}$' and "vector"."shipment_requests"."to_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "requests_dates_check" CHECK ("vector"."shipment_requests"."ready_on" <= "vector"."shipment_requests"."needed_on"),
	CONSTRAINT "requests_urgency_check" CHECK ("vector"."shipment_requests"."urgency" in ('normal', 'urgent', 'critical')),
	CONSTRAINT "requests_dg_check" CHECK ("vector"."shipment_requests"."dangerous_goods" in ('yes', 'no', 'unknown')),
	CONSTRAINT "requests_estimates_check" CHECK (coalesce("vector"."shipment_requests"."estimated_kg", 1) > 0 and coalesce("vector"."shipment_requests"."estimated_m3", 1) > 0 and coalesce("vector"."shipment_requests"."estimated_value_eur", 0) >= 0),
	CONSTRAINT "requests_state_check" CHECK ("vector"."shipment_requests"."state" in ('draft', 'submitted', 'accepted', 'rejected', 'cancelled')),
	CONSTRAINT "requests_reason_check" CHECK ("vector"."shipment_requests"."state" not in ('rejected', 'cancelled') or btrim(coalesce("vector"."shipment_requests"."state_reason", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "vector"."shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"freight_type" text,
	"incoterm" text,
	"incoterm_place" text,
	"from_site" text,
	"from_address" text,
	"from_country" text NOT NULL,
	"to_site" text,
	"to_address" text,
	"to_country" text NOT NULL,
	"port_of_loading" text,
	"port_of_discharge" text,
	"coordinator_id" uuid,
	"coordinator_name" text,
	"payment" text DEFAULT 'open_account' NOT NULL,
	"lc_number" text,
	"lc_bank" text,
	"lc_latest_shipment" date,
	"lc_expiry" date,
	"lc_documents" text[] DEFAULT '{}'::text[] NOT NULL,
	"insurance" text DEFAULT 'policy' NOT NULL,
	"ready_on" date,
	"etd" date,
	"eta" date,
	"latest_eta" date,
	"picked_up_on" date,
	"atd" date,
	"ata" date,
	"delivered_on" date,
	"pod_signed_by" text,
	"pod_codex_ref" text,
	"delivery_reserves" text,
	"packing_validated_at" timestamp with time zone,
	"state" text DEFAULT 'draft' NOT NULL,
	"previous_state" text,
	"state_reason" text,
	"keystone_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_ref_unique" UNIQUE("ref"),
	CONSTRAINT "shipments_ref_check" CHECK ("vector"."shipments"."ref" ~ '^SH-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "shipments_title_check" CHECK (btrim("vector"."shipments"."title") <> ''),
	CONSTRAINT "shipments_mode_check" CHECK ("vector"."shipments"."mode" in ('road', 'sea', 'air', 'rail', 'express', 'multimodal')),
	CONSTRAINT "shipments_freight_check" CHECK ("vector"."shipments"."freight_type" is null or "vector"."shipments"."freight_type" in ('parcel', 'ltl', 'ftl', 'fcl', 'lcl', 'breakbulk', 'roro', 'air_general', 'air_charter')),
	CONSTRAINT "shipments_from_check" CHECK ("vector"."shipments"."from_site" is not null or btrim(coalesce("vector"."shipments"."from_address", '')) <> ''),
	CONSTRAINT "shipments_to_check" CHECK ("vector"."shipments"."to_site" is not null or btrim(coalesce("vector"."shipments"."to_address", '')) <> ''),
	CONSTRAINT "shipments_countries_check" CHECK ("vector"."shipments"."from_country" ~ '^[A-Z]{2}$' and "vector"."shipments"."to_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "shipments_ports_check" CHECK (("vector"."shipments"."port_of_loading" is null or "vector"."shipments"."port_of_loading" ~ '^[A-Z]{2}[A-Z0-9]{3}$') and ("vector"."shipments"."port_of_discharge" is null or "vector"."shipments"."port_of_discharge" ~ '^[A-Z]{2}[A-Z0-9]{3}$')),
	CONSTRAINT "shipments_payment_check" CHECK ("vector"."shipments"."payment" in ('open_account', 'letter_of_credit', 'cash_against_documents', 'prepaid')),
	CONSTRAINT "shipments_lc_check" CHECK ("vector"."shipments"."payment" <> 'letter_of_credit' or btrim(coalesce("vector"."shipments"."lc_number", '')) <> ''),
	CONSTRAINT "shipments_lc_dates_check" CHECK ("vector"."shipments"."lc_latest_shipment" is null or "vector"."shipments"."lc_expiry" is null or "vector"."shipments"."lc_latest_shipment" <= "vector"."shipments"."lc_expiry"),
	CONSTRAINT "shipments_lc_documents_check" CHECK ("vector"."shipments"."lc_documents" <@ array['packing_list','proforma_invoice','commercial_invoice','marks','shipping_instructions','cmr','bill_of_lading','air_waybill','export_declaration','certificate_of_origin','eur1','insurance_certificate','dg_declaration','sds','dual_use_licence','end_use_certificate','ispm15','vgm','pod','lc_documents']::text[]),
	CONSTRAINT "shipments_insurance_check" CHECK ("vector"."shipments"."insurance" in ('none', 'buyer', 'policy', 'specific')),
	CONSTRAINT "shipments_dates_check" CHECK (("vector"."shipments"."etd" is null or "vector"."shipments"."eta" is null or "vector"."shipments"."etd" <= "vector"."shipments"."eta") and ("vector"."shipments"."atd" is null or "vector"."shipments"."ata" is null or "vector"."shipments"."atd" <= "vector"."shipments"."ata") and ("vector"."shipments"."ata" is null or "vector"."shipments"."delivered_on" is null or "vector"."shipments"."ata" <= "vector"."shipments"."delivered_on")),
	CONSTRAINT "shipments_state_check" CHECK ("vector"."shipments"."state" in ('draft', 'planned', 'booked', 'picked_up', 'in_transit', 'arrived', 'delivered', 'closed', 'cancelled', 'on_hold')),
	CONSTRAINT "shipments_previous_state_check" CHECK (("vector"."shipments"."state" = 'on_hold') = ("vector"."shipments"."previous_state" is not null) and ("vector"."shipments"."previous_state" is null or "vector"."shipments"."previous_state" in ('draft', 'planned', 'booked', 'picked_up', 'in_transit', 'arrived', 'delivered', 'closed', 'cancelled', 'on_hold'))),
	CONSTRAINT "shipments_reason_check" CHECK ("vector"."shipments"."state" not in ('cancelled', 'on_hold') or btrim(coalesce("vector"."shipments"."state_reason", '')) <> ''),
	CONSTRAINT "shipments_pod_check" CHECK ("vector"."shipments"."state" not in ('delivered', 'closed') or ("vector"."shipments"."delivered_on" is not null and btrim(coalesce("vector"."shipments"."pod_codex_ref", '')) <> ''))
);
--> statement-breakpoint
CREATE TABLE "vector"."sites" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"city" text,
	"country" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"source" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sites_code_check" CHECK ("vector"."sites"."code" ~ '^[a-z0-9_-]{2,32}$'),
	CONSTRAINT "sites_name_check" CHECK (btrim("vector"."sites"."name") <> ''),
	CONSTRAINT "sites_kind_check" CHECK ("vector"."sites"."kind" in ('workshop', 'warehouse', 'supplier', 'mine', 'port', 'office')),
	CONSTRAINT "sites_country_check" CHECK ("vector"."sites"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "sites_source_check" CHECK ("vector"."sites"."source" in ('matrix', 'local', 'demo')),
	CONSTRAINT "sites_coords_check" CHECK (("vector"."sites"."latitude" is null) = ("vector"."sites"."longitude" is null) and ("vector"."sites"."latitude" is null or ("vector"."sites"."latitude" between -90 and 90 and "vector"."sites"."longitude" between -180 and 180)))
);
--> statement-breakpoint
CREATE TABLE "vector"."tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"occurred_on" date NOT NULL,
	"eta" date,
	"place" text,
	"provider" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tracking_code_check" CHECK ("vector"."tracking_events"."code" in ('ready', 'pickup', 'export_cleared', 'gate_in', 'loaded', 'departed', 'transshipment', 'arrived', 'import_cleared', 'out_for_delivery', 'delivered')),
	CONSTRAINT "tracking_provider_check" CHECK ("vector"."tracking_events"."provider" in ('simulation'))
);
--> statement-breakpoint
ALTER TABLE "vector"."audit_entries" ADD CONSTRAINT "audit_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "vector"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."bookings" ADD CONSTRAINT "bookings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."bookings" ADD CONSTRAINT "bookings_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."compliance_checks" ADD CONSTRAINT "compliance_checks_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."cost_lines" ADD CONSTRAINT "cost_lines_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."cost_lines" ADD CONSTRAINT "cost_lines_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."customs_declarations" ADD CONSTRAINT "customs_declarations_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."customs_declarations" ADD CONSTRAINT "customs_declarations_declarant_id_partners_id_fk" FOREIGN KEY ("declarant_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."incidents" ADD CONSTRAINT "incidents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."incidents" ADD CONSTRAINT "incidents_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."loads" ADD CONSTRAINT "loads_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."milestones" ADD CONSTRAINT "milestones_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."outbox" ADD CONSTRAINT "outbox_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."package_lines" ADD CONSTRAINT "package_lines_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "vector"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."packages" ADD CONSTRAINT "packages_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."packages" ADD CONSTRAINT "packages_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "vector"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."packages" ADD CONSTRAINT "packages_packaging_code_packaging_standards_code_fk" FOREIGN KEY ("packaging_code") REFERENCES "vector"."packaging_standards"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."quotes" ADD CONSTRAINT "quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "vector"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."quotes" ADD CONSTRAINT "quotes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."rfq_invitations" ADD CONSTRAINT "rfq_invitations_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "vector"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."rfq_invitations" ADD CONSTRAINT "rfq_invitations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "vector"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."rfqs" ADD CONSTRAINT "rfqs_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_allocations" ADD CONSTRAINT "shipment_allocations_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_allocations" ADD CONSTRAINT "shipment_allocations_request_id_shipment_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "vector"."shipment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_documents" ADD CONSTRAINT "shipment_documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_requests" ADD CONSTRAINT "shipment_requests_from_site_sites_code_fk" FOREIGN KEY ("from_site") REFERENCES "vector"."sites"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_requests" ADD CONSTRAINT "shipment_requests_to_site_sites_code_fk" FOREIGN KEY ("to_site") REFERENCES "vector"."sites"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_requests" ADD CONSTRAINT "shipment_requests_incoterm_incoterms_code_fk" FOREIGN KEY ("incoterm") REFERENCES "vector"."incoterms"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipment_requests" ADD CONSTRAINT "shipment_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "vector"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipments" ADD CONSTRAINT "shipments_incoterm_incoterms_code_fk" FOREIGN KEY ("incoterm") REFERENCES "vector"."incoterms"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipments" ADD CONSTRAINT "shipments_from_site_sites_code_fk" FOREIGN KEY ("from_site") REFERENCES "vector"."sites"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipments" ADD CONSTRAINT "shipments_to_site_sites_code_fk" FOREIGN KEY ("to_site") REFERENCES "vector"."sites"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."shipments" ADD CONSTRAINT "shipments_coordinator_id_users_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "vector"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector"."tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "vector"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entries_occurred_at_idx" ON "vector"."audit_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_entries_entity_idx" ON "vector"."audit_entries" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "outbox_state_idx" ON "vector"."outbox" USING btree ("state");--> statement-breakpoint
CREATE INDEX "requests_state_idx" ON "vector"."shipment_requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "shipments_state_idx" ON "vector"."shipments" USING btree ("state");--> statement-breakpoint
CREATE INDEX "shipments_updated_at_idx" ON "vector"."shipments" USING btree ("updated_at");