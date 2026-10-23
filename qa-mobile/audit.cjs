// Audit responsive mobile : chaque page × chaque appareil, mesures
// automatiques (débordement, cibles tactiles, police des champs, éléments
// recouverts, erreurs console) et captures pleine page.
//
// Prérequis : l'appli tourne en local (npm run build && npm run start).
// Lancement : NODE_PATH=$(npm root -g) node qa-mobile/audit.cjs
// Variables : BASE_URL (défaut http://localhost:3000), ONLY=<page>[,<page>…] pour
// n'auditer qu'une page, NO_SHOTS=1 pour sauter les captures.
//
// Toutes les routes /api sont servies par qa-mobile/fixtures.cjs : rien ne
// part vers Firebase, HelloAsso ni Resend, et aucune action n'a d'effet.

const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");
const { fixtureFor } = require("./fixtures.cjs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = __dirname;
const SHOTS = !process.env.NO_SHOTS;

const DEVICES = [
  ["galaxy-s9plus", devices["Galaxy S9+"]], // 320 px
  ["android-360", { ...devices["Galaxy S8"] }], // 360 px
  ["iphone-se", devices["iPhone SE"]], // 375 px
  ["iphone-13", devices["iPhone 13"]], // 390 px
  ["pixel-7", devices["Pixel 7"]], // 412 px
  ["iphone-14-pro-max", devices["iPhone 14 Pro Max"]], // 430 px
  ["iphone-13-paysage", devices["iPhone 13 landscape"]],
  ["ipad-mini", devices["iPad Mini"]],
].map(([name, d]) => [name, { ...d, defaultBrowserType: undefined }]);

// États à auditer. `steps` ouvre un état (menu, formulaire, onglet) par des
// clics non destructifs ; `anon` simule un visiteur non connecté.
const click = (sel) => async (page) => {
  await page.locator(sel).first().click();
  await page.waitForTimeout(250);
};
const PAGES = [
  { name: "login", url: "/login", anon: true },
  { name: "setup", url: "/setup", anon: true },
  { name: "dashboard", url: "/dashboard" },
  { name: "menu-mobile", url: "/dashboard", mobileOnly: true, steps: [click('button[aria-label="Ouvrir le menu"]')] },
  { name: "donors", url: "/donors" },
  { name: "donors-form", url: "/donors", steps: [click("text=+ Nouveau fidèle")] },
  { name: "donor-detail", url: "/donors/d1" },
  { name: "donor-edit", url: "/donors/d1", steps: [click("button:has-text('Modifier')"), click("button:has-text('Enregistrer un paiement')")] },
  { name: "donor-hazkara-form", url: "/donors/d1", steps: [click("text=+ Ajouter")] },
  { name: "pledges", url: "/pledges" },
  { name: "pledges-search", url: "/pledges", steps: [async (p) => { await p.fill('input[placeholder="Rechercher un fidèle par nom…"]', "a"); await p.waitForTimeout(200); }] },
  { name: "payments", url: "/payments" },
  { name: "payments-form", url: "/payments", steps: [click("button:has-text('Enregistrer un paiement')")] },
  { name: "treasury", url: "/treasury" },
  { name: "treasury-depenses", url: "/treasury", steps: [click("button:has-text('Dépenses')"), click("text=+ Nouvelle dépense")] },
  { name: "treasury-remises", url: "/treasury", steps: [click("button:has-text('Remises en banque')"), click("text=Tout sélectionner"), click("text=voir le détail")] },
  { name: "receipts", url: "/receipts" },
  { name: "memberships", url: "/memberships" },
  { name: "campaigns", url: "/campaigns", steps: [click("text=+ Nouvelle campagne")] },
  { name: "messages", url: "/messages", steps: [click("button:has-text('Groupes')")] },
  { name: "services", url: "/services", steps: [click("text=Liste complète")] },
  { name: "services-day", url: "/services", steps: [click("text=+ Nouvel office"), async (p) => { await p.locator("button", { hasText: /^24/ }).first().click(); await p.waitForTimeout(200); }] },
  { name: "service-detail", url: "/services/s2" },
  { name: "seating", url: "/seating", steps: [click("text=+ Nouveau plan")] },
  { name: "seating-plan", url: "/seating/pl1", steps: [click('button[title="A2 · libre"]')] },
  { name: "events", url: "/events", steps: [click("text=+ Nouvel événement")] },
  { name: "event-detail", url: "/events/ev1" },
  { name: "hazkarot", url: "/hazkarot" },
  { name: "mikve-admin", url: "/mikve-reservations" },
  { name: "catalog", url: "/catalog" },
  { name: "admin-postes", url: "/admin", steps: [click("text=+ Nouveau poste")] },
  { name: "admin-equipe", url: "/admin", steps: [click("button:has-text('Équipe')"), click("text=+ Nouveau membre")] },
  { name: "admin-association", url: "/admin", steps: [click("button:has-text('Association & reçus fiscaux')")] },
  { name: "admin-relances", url: "/admin", steps: [click("button:has-text('Relances automatiques')")] },
  { name: "admin-paiements", url: "/admin", steps: [click("button:has-text('Paiements')")] },
  { name: "admin-louah", url: "/admin", steps: [click("button:has-text('Écran louah')")] },
  { name: "don", url: "/don", anon: true },
  { name: "don-campagne", url: "/don/renovation-du-heikhal", anon: true },
  { name: "espace-connexion", url: "/espace", anon: true },
  { name: "espace-fidele", url: "/espace", anon: true, donor: true },
  { name: "evenement", url: "/evenement/diner-de-gala-annuel", anon: true },
  { name: "billet", url: "/billet/K7Q2-MX9P", anon: true },
  { name: "mikve", url: "/mikve", anon: true, steps: [click("button:has-text('19h30')")] },
  { name: "louah", url: "/louah", anon: true },
  { name: "merci", url: "/merci", anon: true },
];

async function mockApi(page, { anon, donor }) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(BASE).origin) return route.continue();
    const p = url.pathname;
    if (p.endsWith("/qr")) {
      // QR code : petite image PNG transparente.
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    }
    if (anon && p === "/api/me") return route.fulfill({ json: { user: null } });
    if (p === "/api/espace/me" && !donor) return route.fulfill({ status: 401, json: { error: "non connecté" } });
    if (route.request().method() !== "GET") return route.fulfill({ status: 400, json: { error: "Action bloquée pendant l'audit." } });
    return route.fulfill({ json: fixtureFor(p) });
  });
  // Polices Google : bloquées pour des mesures reproductibles hors ligne.
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
}

// Mesures exécutées dans la page.
// `deviceWidth` : largeur de l'appareil. Sur mobile, le navigateur élargit
// window.innerWidth quand la page déborde (il dézoome) : on ne peut donc pas
// s'y fier pour détecter le débordement.
async function measure(page, deviceWidth) {
  return page.evaluate(async (deviceWidth) => {
    const vw = deviceWidth;
    const issues = [];
    const sel = (el) => {
      if (!el || el === document.body) return "body";
      let s = el.tagName.toLowerCase();
      if (el.id) return `${s}#${el.id}`;
      const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
      if (cls) s += `.${cls}`;
      const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.value || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return text ? `${s} « ${text} »` : s;
    };
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const scrollParentX = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return p;
      }
      return null;
    };
    const inHiddenDrawer = (el) => {
      const aside = el.closest("aside");
      return aside && aside.getBoundingClientRect().right <= 0;
    };

    // a. Débordement horizontal de la page
    const sw = document.documentElement.scrollWidth;
    if (sw > vw) {
      const offenders = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (!visible(el) || scrollParentX(el) || inHiddenDrawer(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1) {
          // Garde l'élément le plus profond : ignore un parent si un enfant déborde aussi.
          offenders.push({ el, right: Math.round(r.right) });
        }
      }
      const deepest = offenders.filter((o) => !offenders.some((x) => x !== o && o.el.contains(x.el)));
      issues.push({ check: "a-debordement", detail: `scrollWidth ${sw} > ${vw}`, selectors: deepest.slice(0, 5).map((o) => `${sel(o.el)} (droite ${o.right}px)`) });
    }

    // b. Éléments interactifs
    // Tiroir mobile ouvert : la page est volontairement masquée, seul le
    // tiroir est audité.
    const openDrawer = [...document.querySelectorAll("aside")].find((a) => getComputedStyle(a).position === "fixed" && a.getBoundingClientRect().right > 0);
    const interactive = [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")].filter(
      (el) => visible(el) && !inHiddenDrawer(el) && el.type !== "hidden" && (!openDrawer || openDrawer.contains(el))
    );
    for (const el of interactive) {
      // Une case à cocher se touche par son libellé.
      const target = (el.type === "checkbox" || el.type === "radio") && el.closest("label") ? el.closest("label") : el;
      const r = target.getBoundingClientRect();
      const sp = scrollParentX(el);
      if (!sp && (r.left < -1 || r.right > vw + 1)) issues.push({ check: "b-hors-ecran", detail: `x ${Math.round(r.left)}→${Math.round(r.right)}`, selectors: [sel(el)] });
      const inlineLink = el.tagName === "A" && el.parentElement && /^(P|SPAN|LI)$/.test(el.parentElement.tagName) && el.parentElement.childNodes.length > 1 && getComputedStyle(el).display === "inline";
      if ((r.width < 44 || r.height < 44) && !inlineLink) {
        issues.push({ check: r.width < 24 || r.height < 24 ? "b-cible-<24" : "b-cible-<44", detail: `${Math.round(r.width)}×${Math.round(r.height)}`, selectors: [sel(target)] });
      }
    }
    // b. Recouvrement : centre de chaque élément après défilement
    for (const el of interactive) {
      if (el.disabled) continue;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
      const y = r.top + Math.min(r.height / 2, 20);
      const hit = document.elementFromPoint(x, y);
      const label = el.closest("label");
      // Liste de suggestions ouverte : elle recouvre volontairement les champs suivants.
      const popup = hit && hit.closest(".absolute.z-10");
      if (popup && !popup.contains(el)) continue;
      if (hit && !(el.contains(hit) || hit.contains(el) || (label && label.contains(hit)) || (el.id && hit.closest(`label[for="${el.id}"]`)))) {
        issues.push({ check: "d-recouvert", detail: `recouvert par ${sel(hit)}`, selectors: [sel(el)] });
      }
    }
    window.scrollTo(0, 0);

    // c. Champs : police ≥ 16 px (sinon Safari iOS zoome au focus)
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (!visible(el) || ["checkbox", "radio", "file", "hidden"].includes(el.type)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) issues.push({ check: "c-police-champ", detail: `${fs}px`, selectors: [sel(el)] });
    }
    // c. Texte coupé sans intention (overflow hidden sans ellipsis)
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || inHiddenDrawer(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX === "hidden" && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.innerText.trim()) {
        issues.push({ check: "c-texte-coupe", detail: `${el.scrollWidth} > ${el.clientWidth}`, selectors: [sel(el)] });
      }
    }
    return issues;
  }, deviceWidth);
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  const only = process.env.ONLY;
  for (const [devName, dev] of DEVICES) {
    for (const pg of PAGES) {
      if (only && !only.split(",").includes(pg.name)) continue;
      if (pg.mobileOnly && dev.viewport.width >= 768) continue;
      const ctx = await browser.newContext({ ...dev, locale: "fr-FR", timezoneId: "Europe/Paris" });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      // Ignorés : refus volontaires des fixtures (400/401), préchargements
      // Next annulés à la fermeture, et hôtes externes (réseau du bac à sable).
      page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(400|401|ERR_TUNNEL)/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 160)}`));
      page.on("requestfailed", (r) => r.url().startsWith(BASE) && !r.url().includes("_rsc=") && errors.push(`requête échouée: ${r.url()}`));
      await mockApi(page, pg);
      let issues = [];
      try {
        await page.goto(BASE + pg.url, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        for (const step of pg.steps || []) await step(page);
        issues = await measure(page, dev.viewport.width);
        if (SHOTS) {
          const dir = path.join(OUT, "screenshots", devName);
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${pg.name}.png`), fullPage: true });
        }
      } catch (e) {
        issues.push({ check: "erreur-audit", detail: e.message.split("\n")[0], selectors: [] });
      }
      for (const e of errors) issues.push({ check: "g-console", detail: e, selectors: [] });
      results.push({ device: devName, width: dev.viewport.width, page: pg.name, issues });
      await ctx.close();
      process.stdout.write(`${devName} ${pg.name}: ${issues.length ? issues.length + " défaut(s)" : "OK"}\n`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
