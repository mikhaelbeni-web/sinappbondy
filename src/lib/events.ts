import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { adminDb } from "./firebaseAdmin";
import { sendTicketEmail } from "./email";

// Événements (dîner de gala, conférence, kiddouch…) : inscription en
// ligne, paiement éventuel, billet à QR code contrôlé à l'entrée.

export interface EventDoc {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string; // yyyy-mm-ddThh:mm (heure de Paris)
  location: string;
  price: number; // € par place, 0 = gratuit
  capacity: number; // 0 = illimité
  active: boolean;
  createdAt: string;
}

export interface RegistrationDoc {
  id: string;
  eventId: string;
  donorId: string;
  name: string;
  email: string;
  qty: number;
  code: string; // code du billet (QR)
  amount: number;
  paymentId: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  createdAt: string;
}

export function ticketCode(): string {
  // 10 caractères sans ambiguïté (pas de 0/O, 1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

export function ticketUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billet/${code}`;
}

export async function seatsTaken(eventId: string): Promise<number> {
  const snap = await adminDb().collection("registrations").where("eventId", "==", eventId).get();
  return snap.docs.reduce((s, d) => s + ((d.data() as any).qty || 0), 0);
}

export async function getEventBySlug(slug: string): Promise<EventDoc | null> {
  const snap = await adminDb().collection("events").where("slug", "==", slug).limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as EventDoc);
}

// Crée l'inscription et envoie le billet. `id` rend l'opération idempotente
// (webhook HelloAsso rejoué : id = checkout).
export async function createRegistration(params: {
  id?: string;
  event: EventDoc;
  donorId: string;
  name: string;
  email: string;
  qty: number;
  amount: number;
  paymentId: string | null;
}): Promise<RegistrationDoc> {
  const db = adminDb();
  const ref = params.id ? db.collection("registrations").doc(params.id) : db.collection("registrations").doc();
  const existing = await ref.get();
  if (existing.exists) return existing.data() as RegistrationDoc;
  const reg: RegistrationDoc = {
    id: ref.id,
    eventId: params.event.id,
    donorId: params.donorId,
    name: params.name,
    email: params.email,
    qty: params.qty,
    code: ticketCode(),
    amount: params.amount,
    paymentId: params.paymentId,
    checkedInAt: null,
    checkedInBy: null,
    createdAt: new Date().toISOString(),
  };
  await ref.set(reg);
  try {
    const png = await QRCode.toBuffer(ticketUrl(reg.code), { type: "png", width: 400, margin: 2 });
    await sendTicketEmail({ to: reg.email, name: reg.name, event: params.event, qty: reg.qty, code: reg.code, url: ticketUrl(reg.code), qrPng: png });
  } catch (e) {
    console.warn("[events] billet non envoyé:", e);
  }
  return reg;
}

export function formatEventDate(date: string): string {
  const d = new Date(`${date}:00`);
  return d.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
