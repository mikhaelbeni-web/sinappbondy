import { adminDb } from "./firebaseAdmin";
import { remainingOf } from "./format";
import { sendDonorStatement } from "./statements";

// Relances automatiques : un relevé par fidèle (pas un e-mail par
// promesse), selon un calendrier réglé dans Administration > Relances.

export interface ReminderSettings {
  enabled: boolean;
  firstDelayDays: number; // première relance N jours après la promesse
  repeatEveryDays: number; // puis tous les N jours
  maxReminders: number; // plafond par promesse
  updatedAt: string;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  firstDelayDays: 7,
  repeatEveryDays: 30,
  maxReminders: 3,
  updatedAt: "",
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const snap = await adminDb().collection("settings").doc("reminders").get();
  return { ...DEFAULT_REMINDER_SETTINGS, ...(snap.exists ? (snap.data() as any) : {}) };
}

const DAY = 86400_000;

// Une promesse est « due à relancer » si elle a assez d'ancienneté, que la
// dernière relance est assez lointaine et que le plafond n'est pas atteint.
function isDue(p: any, s: ReminderSettings, now: number): boolean {
  if (remainingOf(p) <= 0) return false;
  if ((p.remindersSentCount || 0) >= s.maxReminders) return false;
  if (now - new Date(p.createdAt).getTime() < s.firstDelayDays * DAY) return false;
  if (p.lastReminderAt && now - new Date(p.lastReminderAt).getTime() < s.repeatEveryDays * DAY) return false;
  return true;
}

// Pas d'envoi le Chabbat ni les jours de fête (offices de type « fête »
// importés depuis Hebcal), heure de Paris.
export async function isRestDay(date = new Date()): Promise<string | null> {
  const paris = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const parts = Object.fromEntries(paris.formatToParts(date).map((p) => [p.type, p.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(date);
  if (weekday === "Sat") return "Chabbat";
  const snap = await adminDb().collection("services").where("date", "==", iso).get();
  const fete = snap.docs.map((d) => d.data() as any).find((s) => s.type === "fete");
  return fete ? fete.label : null;
}

export async function planReminders(settings?: ReminderSettings) {
  const s = settings || (await getReminderSettings());
  const now = Date.now();
  const [pledgesSnap, donorsSnap] = await Promise.all([adminDb().collection("pledges").get(), adminDb().collection("donors").get()]);
  const donors = new Map(donorsSnap.docs.map((d) => [d.id, d.data() as any]));
  const byDonor = new Map<string, any[]>();
  for (const d of pledgesSnap.docs) {
    const p = d.data() as any;
    const list = byDonor.get(p.donorId) || [];
    list.push(p);
    byDonor.set(p.donorId, list);
  }
  const plan: { donorId: string; donorName: string; email: string; due: number; pledges: any[] }[] = [];
  for (const [donorId, pledges] of byDonor) {
    if (!pledges.some((p) => isDue(p, s, now))) continue;
    const donor = donors.get(donorId);
    if (!donor?.email) continue;
    plan.push({
      donorId,
      donorName: `${donor.firstName} ${donor.lastName}`,
      email: donor.email,
      due: pledges.reduce((sum, p) => sum + remainingOf(p), 0),
      pledges,
    });
  }
  return plan.sort((a, b) => a.donorName.localeCompare(b.donorName, "fr"));
}

export async function runReminders(trigger: "cron" | "manuel", by: string) {
  const settings = await getReminderSettings();
  const rest = await isRestDay();
  const db = adminDb();
  if (trigger === "cron" && (!settings.enabled || rest)) {
    const skipped = !settings.enabled ? "relances automatiques désactivées" : `pas d'envoi : ${rest}`;
    return { sent: 0, failed: [], skipped };
  }
  if (rest) return { sent: 0, failed: [], skipped: `pas d'envoi : ${rest}` };

  const plan = await planReminders(settings);
  let sent = 0;
  const failed: { donorName: string; error: string }[] = [];
  for (const item of plan) {
    try {
      await sendDonorStatement(item.donorId, item.pledges);
      sent++;
    } catch (e: any) {
      failed.push({ donorName: item.donorName, error: e?.message || "Erreur" });
    }
  }
  await db.collection("reminderRuns").add({ at: new Date().toISOString(), trigger, by, sent, failed });
  return { sent, failed, skipped: null as string | null };
}
