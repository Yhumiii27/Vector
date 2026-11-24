// Platform tables (copied from Clavis, itself from Keystone; docs/SOCLE.md): users (who signed in, for the audit trail —
// their rights are read in Clavis), settings, the append-only audit trail (trigger in the migration 0001), the job runs and
// the yearly counters of the business references.
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { vector } from './_schema';
import { id, notBlank } from './_common';

export const users = vector.table('users', {
  id: id(),
  /** Object id of the Clavis / Entra token (`oid`), null for the demonstration personas. */
  oid: text('oid').unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
}, (t) => [
  check('users_email_check', sql`${t.email} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' and ${t.email} = lower(${t.email})`),
  check('users_name_check', notBlank(t.name)),
]);

export const appSettings = vector.table('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByName: text('updated_by_name').notNull(),
}, (t) => [check('app_settings_key_check', sql`${t.key} ~ '^[a-z][a-z0-9_.-]{1,63}$'`)]);

/** Append-only (database trigger): never updated nor deleted, in code or tests. */
export const auditEntries = vector.table('audit_entries', {
  id: id(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role'),
  /** Business reference of the object: "SH-2026-0012", "Partner Transports Alpha". */
  objectRef: text('object_ref').notNull(),
  /** "state: Planned → Booked" (EN source text). */
  change: text('change').notNull(),
  /** "Shipments", "Partners", "Administration"… */
  area: text('area').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  before: jsonb('before').$type<Record<string, unknown>>(),
  after: jsonb('after').$type<Record<string, unknown>>(),
  reason: text('reason'),
}, (t) => [
  index('audit_entries_occurred_at_idx').on(t.occurredAt),
  index('audit_entries_entity_idx').on(t.entityId),
  check('audit_entries_text_check', sql`btrim(${t.actorName}) <> '' and btrim(${t.objectRef}) <> '' and btrim(${t.change}) <> '' and btrim(${t.area}) <> ''`),
]);

/** Scheduled jobs (src/server/jobs): last run and a lease. */
export const jobRuns = vector.table('job_runs', {
  name: text('name').primaryKey(),
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
  lastFinishedAt: timestamp('last_finished_at', { withTimezone: true }),
  lastStatus: text('last_status').$type<'ok' | 'error'>(),
  lastError: text('last_error'),
}, (t) => [check('job_runs_status_check', sql`${t.lastStatus} is null or ${t.lastStatus} in ('ok', 'error')`)]);

/** Yearly counters of the references SR-, SH-, RFQ-, INC- (taken inside the writing transaction, behind the write lock). */
export const counters = vector.table('counters', {
  prefix: text('prefix').notNull(),
  year: integer('year').notNull(),
  value: integer('value').notNull(),
}, (t) => [
  primaryKey({ columns: [t.prefix, t.year] }),
  check('counters_prefix_check', sql`${t.prefix} in ('SR', 'SH', 'RFQ', 'INC')`),
  check('counters_values_check', sql`${t.year} between 2000 and 2999 and ${t.value} between 0 and 9999`),
]);
