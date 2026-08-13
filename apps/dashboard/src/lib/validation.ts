import { z } from "zod";

export const reminderInputSchema = z.object({
  offsetMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 365),
  channelId: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
});

export const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(4000).optional().nullable(),
  kind: z.enum(["MEETING", "EVENT", "CUSTOM"]),
  startAt: z.string().min(1, "Start time is required"),
  endAt: z.string().optional().nullable(),
  allDay: z.boolean().default(false),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .optional()
    .nullable(),
  recurrence: z.enum(["NONE", "WEEKLY", "MONTHLY", "YEARLY"]).default("NONE"),
  // Discord user ids expected at a meeting; empty for other kinds.
  attendeeIds: z.array(z.string()).default([]),
  location: z.string().max(300).optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  channelId: z.string().min(1, "Select a channel"),
  announceOnCreate: z.boolean().default(true),
  // Who gets pinged on the announcement and reminders.
  mentionRoleIds: z.array(z.string()).max(100).default([]),
  mentionUserIds: z.array(z.string()).max(100).default([]),
  mentionEveryone: z.boolean().default(false),
  reminders: z.array(reminderInputSchema).max(20).default([]),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type ReminderInput = z.infer<typeof reminderInputSchema>;

export const reminderDefaultSchema = z.object({
  kind: z.enum(["MEETING", "EVENT", "CUSTOM"]),
  offsetMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 365),
});

export const settingsSchema = z.object({
  timezone: z.string().min(1),
  defaultChannelId: z.string().optional().nullable(),
  defaults: z.array(reminderDefaultSchema).max(60),
});

export type SettingsValues = z.infer<typeof settingsSchema>;

/** Blank inputs arrive as "" and should be stored as nothing at all. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const contactSchema = z.object({
  kind: z.enum(["SPONSOR", "COLLABORATION"]),
  name: z.string().trim().min(1, "A name is required").max(200),
  person: optionalText(120),
  role: optionalText(120),
  email: optionalText(200),
  phone: optionalText(60),
  instagram: optionalText(120),
  linkedin: optionalText(300),
  website: optionalText(300),
  notes: optionalText(2000),
});

export type ContactValues = z.infer<typeof contactSchema>;

export const orgProfileSchema = z.object({
  name: optionalText(300),
  address: optionalText(300),
  fiscalCode: optionalText(60),
  iban: optionalText(60),
  bank: optionalText(120),
  representative: optionalText(120),
  email: optionalText(200),
  phone: optionalText(60),
  website: optionalText(300),
  instagram: optionalText(120),
  linkedin: optionalText(300),
  notes: optionalText(2000),
});

export type OrgProfileValues = z.infer<typeof orgProfileSchema>;
