// Données fictives servies à la place des routes /api pendant l'audit :
// aucune requête ne part vers Firebase, HelloAsso ou Resend. Les noms et
// libellés sont volontairement longs pour faire ressortir les débordements.

const ADMIN_ROLE = { id: "admin", name: "Administrateur", isAdmin: true, permissions: [], createdAt: "2026-01-01" };
const user = { uid: "u1", email: "tresorier.synagogue@example.org", name: "Mikhael Benichou", roleId: "admin", role: ADMIN_ROLE };

const donors = [
  { id: "d1", firstName: "Jean-Baptiste", lastName: "Abergel-Benhamou", email: "jean-baptiste.abergel-benhamou@exemple-tres-long.fr", phone: "06 12 34 56 78" },
  { id: "d2", firstName: "Sarah", lastName: "Cohen", email: "sarah.cohen@example.org", phone: "" },
  { id: "d3", firstName: "David", lastName: "Lévy", email: "", phone: "07 00 00 00 00" },
];

const pledges = [
  { id: "p1", donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", donorEmail: "a@b.fr", serviceId: "s1", serviceLabel: "Roch Hachana, 1er jour (Cha'harit)", catalogItemId: null, catalogItemName: "Ouverture du Heikhal pour la sortie du Séfer", amount: 1800, amountPaid: 600, status: "partiel", notes: "Réglera en trois fois", createdBy: "u1", createdByName: "Mikhael Benichou", createdAt: "2026-09-23T10:00:00Z" },
  { id: "p2", donorId: "d2", donorName: "Sarah Cohen", donorEmail: "s@c.fr", serviceId: "s2", serviceLabel: "Shabbat Bereshit", catalogItemId: "c1", catalogItemName: "Maftir", amount: 180, amountPaid: 0, status: "en_attente", notes: "", createdBy: "u1", createdByName: "Mikhael Benichou", createdAt: "2026-10-17T10:00:00Z" },
  { id: "p3", donorId: "d3", donorName: "David Lévy", donorEmail: "", serviceId: "s2", serviceLabel: "Shabbat Bereshit", catalogItemId: "c2", catalogItemName: "Hagbaha", amount: 54, amountPaid: 54, status: "paye", notes: "", createdBy: "u1", createdByName: "Mikhael Benichou", createdAt: "2026-10-17T10:00:00Z" },
];

const services = [
  { id: "s1", date: "2026-10-03", type: "fete", label: "Roch Hachana, 1er jour (Cha'harit)", notes: "", closed: false },
  { id: "s2", date: "2026-10-17", type: "shabbat", label: "Shabbat Bereshit", notes: "", closed: false },
  { id: "s3", date: "2026-10-24", type: "shabbat", label: "Shabbat Noa'h", notes: "", closed: false },
  { id: "s4", date: "2026-10-24", type: "autre", label: "Cours du samedi soir", notes: "", closed: false },
  { id: "s5", date: "2026-10-24", type: "autre", label: "Mélavé malka", notes: "", closed: false },
];

const catalog = [
  { id: "c1", name: "Maftir", category: "shabbat", order: 1, active: true },
  { id: "c2", name: "Hagbaha", category: "shabbat", order: 2, active: true },
  { id: "c3", name: "Ouverture du Heikhal pour Kol Nidré (montée exceptionnelle)", category: "fete", order: 3, active: false },
];

const payments = [
  { id: "t1", donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", amount: 600, method: "cheque", reference: "Chèque n° 0001234 Société Générale", date: "2026-10-01", notes: "Premier versement", allocations: [], unallocated: 50, createdByName: "Mikhael Benichou", receiptId: "r1" },
  { id: "t2", donorId: "d3", donorName: "David Lévy", amount: 54, method: "especes", reference: "", date: "2026-10-18", notes: "", allocations: [], unallocated: 0, createdByName: "Mikhael Benichou" },
];

const receipt = {
  id: "r1", number: "2026/00001", year: 2026, kind: "unitaire", donorId: "d1",
  donor: { name: "Jean-Baptiste Abergel-Benhamou", address: "", postalCode: "", city: "", email: "" },
  amount: 600, payments: [], periodStart: "2026-10-01", periodEnd: "2026-10-01",
  issuedAt: "2026-10-01T10:00:00Z", emailedAt: null, cancelled: false,
};

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 10 + i, 1);
  return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, amount: 400 + i * 310, promised: 900 + ((i * 577) % 2500) };
});

const schedule = { 0: [{ start: "19:00", end: "22:00" }], 1: [], 2: [{ start: "20:00", end: "22:30" }, { start: "06:00", end: "07:30" }], 3: [], 4: [{ start: "20:00", end: "22:00" }], 5: [], 6: [] };

const routes = {
  "/api/me": { user },
  "/api/setup": { needsSetup: false },
  "/api/dashboard": {
    counts: { enAttente: 4, relanceEnvoyee: 2, partiel: 1, paye: 12, annule: 0 },
    amounts: { total: 25480, paye: 12000, du: 13480 },
    movements: [
      { kind: "paiement", date: "2026-10-18", name: "David Lévy", donorId: "d3", detail: "Espèces 54,00 €" },
      { kind: "promesse", date: "2026-10-17", name: "Jean-Baptiste Abergel-Benhamou", donorId: "d1", detail: "Ouverture du Heikhal pour la sortie du Séfer 1 800,00 €" },
    ],
    registrations: 37, donorsToRemind: 5,
    cash: { months, byMethod: { cheque: 3000, especes: 400 }, thisMonth: 654, thisYear: 12000, unallocated: 50 },
    total: 19,
  },
  "/api/donors": { donors },
  "/api/donors/d1": {
    donor: { ...donors[0], address: "28 avenue de la Villageoise, bâtiment B, escalier 3", postalCode: "93140", city: "Bondy", groups: ["Conseil", "Jeunes", "Cours du mardi"], membershipTier: "Famille" },
    pledges: pledges.filter((p) => p.donorId === "d1").concat([{ ...pledges[1], id: "p9", donorId: "d1" }]),
    payments: payments.filter((p) => p.donorId === "d1"),
    receipts: [receipt],
    balancePayUrl: "http://localhost:3000/api/pay?t=abc",
  },
  "/api/services": { services },
  "/api/services/s2": { service: services[1], pledges: pledges.filter((p) => p.serviceId === "s2") },
  "/api/catalog": { items: catalog },
  "/api/pledges": { pledges },
  "/api/transactions": { payments },
  "/api/treasury": {
    income: 12654, nonDeductible: 450, expenses: 8300, net: 4354,
    months: Array.from({ length: 12 }, (_, i) => ({ income: 500 + i * 100, expenses: 300 + ((i * 211) % 900) })),
    byMethod: { cheque: 8000, especes: 654, virement: 4000 }, byCategory: { loyer: 6000, energie: 2300 },
  },
  "/api/expenses": { expenses: [{ id: "e1", date: "2026-09-30", amount: 1500, category: "loyer", label: "Loyer du local de l'avenue de la Villageoise (septembre)", supplier: "SCI Les Tilleuls", method: "virement", reference: "FAC-2026-09-00123" }] },
  "/api/deposits": {
    pending: [
      { id: "t1", donorName: "Jean-Baptiste Abergel-Benhamou", date: "2026-10-01", reference: "0001234", amount: 600, method: "cheque" },
      { id: "t2", donorName: "David Lévy", date: "2026-10-18", reference: "", amount: 54, method: "especes" },
    ],
    deposits: [{ id: "dep1", date: "2026-09-15", method: "cheque", count: 3, reference: "BR-778899", createdByName: "Mikhael Benichou", total: 1234, payments: [{ donorName: "Sarah Cohen", date: "2026-09-10", reference: "556677", amount: 1234 }] }],
  },
  "/api/receipts": {
    receipts: [receipt, { ...receipt, id: "r2", number: "2026/00002", cancelled: true }],
    pending: [{ donorId: "d2", donorName: "Sarah Cohen", amount: 180, paymentIds: ["x"], hasAddress: false, hasEmail: true }],
    missing: ["N° RNA", "Signataire"],
  },
  "/api/memberships": {
    tiers: [{ name: "Famille", amount: 360 }, { name: "Individuel", amount: 180 }],
    rows: [{ pledgeId: "m1", donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", tier: "Famille", amount: 360, paid: 100, remaining: 260, status: "partiel" }],
    donorCount: 3, groups: ["Conseil", "Jeunes"],
  },
  "/api/campaigns": {
    generalUrl: "http://localhost:3000/don",
    campaigns: [{ id: "k1", slug: "renovation-du-heikhal", title: "Rénovation du Heikhal et des bancs de la grande salle", url: "http://localhost:3000/don/renovation-du-heikhal", active: true, goal: 20000, raised: 7350, donations: 41 }],
  },
  "/api/messages": {
    history: [{ subject: "Horaires des offices de Souccot et du kiddouch communautaire", sentAt: "2026-10-01T10:00:00Z", audience: { type: "groupes", groups: ["Conseil", "Jeunes"] }, sent: 120, failed: 2, sentBy: "Mikhael Benichou" }],
    groups: ["Conseil", "Jeunes", "Cours du mardi"], count: 118,
  },
  "/api/seating": { plans: [{ id: "pl1", name: "Roch Hachana et Kippour 5787", sections: [{ name: "Hommes" }, { name: "Femmes" }], assigned: 42, capacity: 216 }] },
  "/api/seating/pl1": {
    plan: { id: "pl1", name: "Roch Hachana et Kippour 5787", sections: [{ id: "hommes", name: "Hommes", rows: 4, seatsPerRow: 12, price: 150 }, { id: "femmes", name: "Femmes", rows: 3, seatsPerRow: 12, price: 150 }] },
    seats: [{ id: "pl1_hommes_1_1", planId: "pl1", sectionId: "hommes", row: 1, seat: 1, donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", remaining: 150, pledgeId: "x", confirmedAt: null }],
  },
  "/api/events": { events: [{ id: "ev1", title: "Dîner de gala annuel de la communauté", date: "2026-12-13T19:30", active: true, qty: 37, capacity: 120, checkedIn: 0, price: 85, amount: 3145 }] },
  "/api/events/ev1": {
    event: { id: "ev1", title: "Dîner de gala annuel de la communauté", date: "2026-12-13T19:30", location: "Salle des fêtes, 28 avenue de la Villageoise, Bondy", active: true, capacity: 120, price: 85 },
    url: "http://localhost:3000/evenement/diner-de-gala-annuel",
    registrations: [
      { id: "g1", name: "Jean-Baptiste Abergel-Benhamou", email: "jean-baptiste.abergel-benhamou@exemple-tres-long.fr", code: "K7Q2-MX9P", qty: 4, amount: 340, checkedInAt: null },
      { id: "g2", name: "Sarah Cohen", email: "sarah.cohen@example.org", code: "ZZ81-0P2A", qty: 1, amount: 85, checkedInAt: "2026-12-13T19:42:00Z" },
    ],
  },
  "/api/hazkarot": {
    hazkarot: [{ id: "h1", donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", deceasedName: "Rahel bat Messaouda Abergel", relation: "grand-mère", deathDate: "2001-03-12", hebrewDate: "17 Adar 5761", next: { date: "2027-02-24", hebrew: "17 Adar 5787" } }],
    settings: { enabled: true, daysBefore: 7 },
  },
  "/api/mikve": {
    settings: { enabled: true, slotMinutes: 30, daysAhead: 14, price: 20, schedule, instructions: "Merci d'arriver cinq minutes en avance." },
    bookings: [{ id: "b1", date: "2026-10-25", time: "20:30", name: "Myriam", phone: "06 11 22 33 44", email: "myriam.exemple-adresse-longue@example.org" }],
    publicUrl: "http://localhost:3000/mikve",
  },
  "/api/roles": { roles: [ADMIN_ROLE, { id: "tres", name: "Trésorier", isAdmin: false, permissions: ["gerer_paiements", "voir_tout", "envoyer_relances"] }] },
  "/api/team": { team: [{ id: "u1", name: "Mikhael Benichou", email: "tresorier.synagogue@example.org", roleId: "admin", active: true }, { id: "u2", name: "Ancien gabbaï", email: "gabbai@example.org", roleId: "tres", active: false }] },
  "/api/association": {
    association: { legalName: "Association Culturelle et d'Instruction de Bondy", address: "28 avenue de la Villageoise", postalCode: "93140", city: "Bondy", object: "Activités culturelles, d'instruction et sociales", rna: "", siren: "798131926", category: "interet_general", signatoryName: "", signatoryTitle: "", autoReceipt: true },
    missing: ["N° RNA", "Signataire"],
  },
  "/api/reminders/auto": {
    settings: { enabled: true, firstDelayDays: 7, repeatEveryDays: 14, maxReminders: 3 },
    plan: [{ donorId: "d1", donorName: "Jean-Baptiste Abergel-Benhamou", due: 1200 }],
    runs: [{ at: "2026-10-22T08:00:00Z", trigger: "cron", sent: 4, failed: [] }],
    cronConfigured: true, restDay: null,
  },
  "/api/payments": { hasClientId: true, hasClientSecret: true, organizationSlug: "acib-bondy", organizationName: "Association Culturelle et d'Instruction de Bondy", sandbox: false, webhookUrl: "https://sinappbondy.vercel.app/api/helloasso/webhook" },
  "/api/louah": {
    settings: { title: "Synagogue de Bondy", city: "Bondy", latitude: 48.9, longitude: 2.48, candleMinutes: 18, showZmanim: true, showHazkarot: true, times: [{ label: "Cha'harit en semaine", value: "7h00" }], announcements: "Kiddouch offert par la famille Cohen" },
    url: "http://localhost:3000/louah",
  },
  // Pages publiques
  "/api/public/campaigns/renovation-du-heikhal": { campaign: { title: "Rénovation du Heikhal et des bancs de la grande salle", description: "Aidez-nous à rénover le Heikhal.\nChaque don compte.", goal: 20000, raised: 7350, donations: 41, suggestedAmounts: [18, 36, 54, 100, 180, 360] } },
  "/api/public/events/diner-de-gala-annuel": { event: { title: "Dîner de gala annuel de la communauté", date: "2026-12-13T19:30", location: "Salle des fêtes, 28 avenue de la Villageoise, Bondy", description: "Soirée de soutien à la synagogue.", price: 85, remaining: 83 } },
  "/api/public/tickets/K7Q2-MX9P": { ticket: { code: "K7Q2-MX9P", name: "Jean-Baptiste Abergel-Benhamou", qty: 4, checkedInAt: null }, event: { title: "Dîner de gala annuel de la communauté", date: "2026-12-13T19:30", location: "Salle des fêtes, Bondy" } },
  "/api/public/mikve": {
    enabled: true, price: 20, instructions: "Merci d'arriver cinq minutes en avance.",
    days: [{ date: "2026-10-25", slots: ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"].map((t, i) => ({ time: t, free: i !== 2 })) }],
  },
  "/api/espace/me": {
    donor: { firstName: "Jean-Baptiste", lastName: "Abergel-Benhamou", hasAddress: true },
    balance: 1380, balanceUrl: "http://localhost:3000/api/pay?t=abc",
    pledges: [{ id: "p1", label: "Ouverture du Heikhal pour la sortie du Séfer", service: "Roch Hachana, 1er jour (Cha'harit)", date: "2026-09-23", amount: 1800, remaining: 1200, status: "partiel" }],
    receipts: [{ id: "r1", number: "2026/00001", kind: "unitaire", year: 2026, issuedAt: "2026-10-01", amount: 600 }],
    payments: [{ id: "t1", date: "2026-10-01", method: "cheque", amount: 600 }],
  },
  "/api/public/louah": {
    title: "Synagogue de Bondy", civilDate: "2026-10-23", hebrewDate: "12 Hechvan 5787", hebrewDateHe: "י״ב חשון תשפ״ז",
    parasha: { name: "Lekh Lekha", hebrew: "לך לך" }, candle: { date: "2026-10-23", time: "18:12" }, havdalah: { date: "2026-10-24", time: "19:20" },
    holidays: [], times: [{ label: "Cha'harit en semaine", value: "7h00" }, { label: "Min'ha et Arvit du vendredi soir", value: "18h15" }],
    zmanim: [{ label: "Lever du soleil", time: "08:31" }, { label: "Fin du Chema (Gra)", time: "11:02" }], city: "Bondy",
    announcements: ["Kiddouch offert par la famille Cohen à l'occasion de la bar-mitsva de David"], services: [{ date: "2026-10-24", label: "Shabbat Noa'h", notes: "" }], hazkarot: [{ name: "Rahel bat Messaouda", hebrew: "17 Hechvan" }],
  },
};

// Réponse d'une route : correspondance exacte du chemin, sinon objet vide.
function fixtureFor(pathname) {
  return routes[pathname] ?? {};
}

module.exports = { fixtureFor, user };
