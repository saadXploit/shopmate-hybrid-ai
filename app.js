// ShopMate: a hybrid on-device / cloud AI assistant for small shops.
// AI runs through Firebase AI Logic. With "Prefer on-device" it uses Gemini Nano in Chrome
// when available, and falls back to the cloud Gemini model otherwise.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource,
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-ai.js";
import {
  initializeAppCheck, ReCaptchaEnterpriseProvider,
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js";
import { firebaseConfig, appCheckSiteKey } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);

// ---------- Firebase + App Check ----------
const app = initializeApp(firebaseConfig);

// App Check is enforced for Firebase AI Logic. In production we use reCAPTCHA Enterprise.
// Without a site key (local testing / judging) we fall back to an App Check debug token,
// which must be registered in Firebase console > App Check > Apps > Manage debug tokens.
if (!appCheckSiteKey) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey || "debug-mode"),
  isTokenAutoRefreshEnabled: true,
});

const ai = getAI(app, { backend: new GoogleAIBackend() });

const SYSTEM = `You are ShopMate, an assistant for small business owners (often in Nigeria and other
emerging markets). Write short, natural, ready-to-send text. Never invent prices, stock levels,
delivery times or policies: only use facts the owner gives you, and if something important is
missing, leave a clear [placeholder] for the owner to fill in. No markdown headings.`;

const models = {};
function modelFor(mode) {
  if (!models[mode]) {
    models[mode] = getGenerativeModel(ai, {
      mode,
      inCloudParams: { model: "gemini-3.5-flash-lite" },
    });
  }
  return models[mode];
}
const currentMode = () => document.querySelector('input[name="mode"]:checked').value;

// ---------- On-device availability ----------
async function checkDevice() {
  const dot = $("statusDot"), text = $("statusText");
  if (!("LanguageModel" in self)) {
    dot.className = "dot cloud";
    text.textContent = "On-device AI not available in this browser: using cloud";
    return "unavailable";
  }
  try {
    const a = await LanguageModel.availability();
    const map = {
      available: ["dot device", "On-device AI ready (Gemini Nano)"],
      downloadable: ["dot warn", "On-device model can be downloaded"],
      downloading: ["dot warn", "On-device model downloading…"],
      unavailable: ["dot cloud", "On-device AI unavailable: using cloud"],
    };
    const [c, t] = map[a] || ["dot cloud", `On-device status: ${a}`];
    dot.className = c; text.textContent = t;
    return a;
  } catch (e) {
    dot.className = "dot cloud"; text.textContent = "Could not check on-device AI: using cloud";
    return "unavailable";
  }
}
checkDevice();

$("downloadBtn").addEventListener("click", async () => {
  const wrap = $("progressWrap"), bar = $("progressBar");
  wrap.hidden = false; bar.style.width = "2%";
  try {
    // Must be triggered by a user action. Downloads Gemini Nano if the device supports it.
    await modelFor(InferenceMode.PREFER_ON_DEVICE).initializeDeviceModel((p) => {
      const pct = typeof p === "number" ? p : (p?.loaded ?? 0);
      bar.style.width = `${Math.max(2, Math.round(pct * 100))}%`;
    });
    bar.style.width = "100%";
  } catch (e) {
    console.warn(e);
  }
  await checkDevice();
  setTimeout(() => (wrap.hidden = true), 1500);
});

// ---------- Prompts ----------
const shop = () => $("shop").value.trim() || "[shop name and details]";

const builders = {
  reply() {
    const msg = $("customerMsg").value.trim();
    if (!msg) throw new Error("Paste the customer's message first.");
    return [`${SYSTEM}

Shop: ${shop()}
Customer message: """${msg}"""
Facts I can share: ${$("replyFacts").value.trim() || "none given"}
Tone: ${$("replyTone").value}
Write one reply I can paste into WhatsApp. Max 80 words. End with a clear next step.`];
  },
  async product() {
    const name = $("productName").value.trim();
    if (!name) throw new Error("Add a product name first.");
    const prompt = `${SYSTEM}

Shop: ${shop()}
Product: ${name}
Details: ${$("productDetails").value.trim() || "none given"}
Write a product description for Instagram/WhatsApp catalog: a one-line hook, 3 short benefit
bullets using "•", and a call to action. Max 90 words.${imagePart ? " Use what you can see in the photo." : ""}`;
    return imagePart ? [prompt, imagePart] : [prompt];
  },
  invoice() {
    const name = $("invName").value.trim(), amount = $("invAmount").value.trim();
    if (!name || !amount) throw new Error("Add the customer's name and the amount.");
    return [`${SYSTEM}

Shop: ${shop()}
Customer: ${name}
Amount owed: ${amount}
For: ${$("invFor").value.trim() || "[item]"}
Days overdue: ${$("invDays").value || "[days]"}
Stage: ${$("invStage").value}
Write a payment reminder message (max 70 words) that protects the relationship.
Include the amount and ask for a specific payment date.`];
  },
};

// ---------- Optional product photo (JPEG/PNG is supported on-device) ----------
let imagePart = null;
$("productImage").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) { imagePart = null; $("productPreview").hidden = true; return; }
  const b64 = await new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(f);
  });
  imagePart = { inlineData: { data: b64, mimeType: f.type } };
  $("productPreview").src = URL.createObjectURL(f); $("productPreview").hidden = false;
});

// ---------- Run ----------
const stats = { device: 0, cloud: 0 };
async function run(kind, btn) {
  const out = $("output"), card = $("outputCard"), badge = $("sourceBadge");
  let parts;
  try { parts = await builders[kind](); } catch (e) { alert(e.message); return; }
  btn.disabled = true; const label = btn.textContent; btn.textContent = "Writing…";
  card.hidden = false; out.textContent = ""; badge.textContent = "…"; badge.className = "badge";
  const t0 = performance.now();
  try {
    const result = await modelFor(currentMode()).generateContentStream(parts);
    for await (const chunk of result.stream) out.textContent += chunk.text();
    const response = await result.response;
    const onDevice = response.inferenceSource === InferenceSource.ON_DEVICE;
    badge.textContent = onDevice ? "On-device · private · offline-capable" : "Cloud · Gemini";
    badge.className = "badge " + (onDevice ? "device" : "cloud");
    onDevice ? stats.device++ : stats.cloud++;
    $("statDevice").textContent = stats.device; $("statCloud").textContent = stats.cloud;
    $("statSaved").textContent = stats.device;
    $("timing").textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    $("waBtn").href = "https://wa.me/?text=" + encodeURIComponent(out.textContent.trim());
  } catch (e) {
    console.error(e);
    out.textContent = "Something went wrong: " + (e.message || e) +
      "\n\nTip: on-device needs Chrome 139+ with Gemini Nano enabled. Try 'Prefer on-device' or 'Cloud only'.";
    badge.textContent = "Error"; badge.className = "badge err";
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}
document.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => run(b.dataset.run, b)));

// ---------- UI helpers ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== `panel-${t.dataset.tab}`));
}));
$("copyBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("output").textContent.trim());
  $("copyBtn").textContent = "Copied"; setTimeout(() => ($("copyBtn").textContent = "Copy"), 1200);
});
// Remember the shop profile on this device only.
try {
  $("shop").value = localStorage.getItem("shopmate.shop") || "";
  $("shop").addEventListener("input", () => localStorage.setItem("shopmate.shop", $("shop").value));
} catch {}
