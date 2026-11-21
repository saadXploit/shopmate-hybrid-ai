# ShopMate: private AI for small shops

**ShopMate writes customer replies, product descriptions and payment reminders for small business owners. It runs on-device with Gemini Nano when it can, and falls back to the cloud when it can't, using Firebase AI Logic hybrid inference.**

Built for the **#BuildHybridAI 2026** hackathon (Web / Chrome).

## Why hybrid matters here

Millions of small shops (in Nigeria, where I'm based, and across emerging markets) sell on WhatsApp and Instagram. The owner answers every message, chases every unpaid invoice and writes every product post by hand.

Cloud-only AI is a poor fit for them:

- **Data is expensive and connections drop.** On-device inference keeps working on a bad connection.
- **Customer messages are private.** With on-device inference the text never leaves the shop owner's computer.
- **Per-request cost adds up.** Every on-device request is free.

But not every device can run a local model, so ShopMate **prefers on-device and falls back to the cloud automatically**, and shows the owner which one answered each request.

## Features

| Tool | What it does |
|---|---|
| Reply to customer | Turns a customer's message plus your facts into a ready-to-send WhatsApp reply, in your chosen tone (including Pidgin-friendly). |
| Product description | Writes a catalog/Instagram description from a name, details and an optional JPEG/PNG photo (image input works on-device too). |
| Payment reminder | Writes gentle, firm or final reminders that protect the customer relationship. |

Every output shows a badge (**On-device · private** or **Cloud · Gemini**), streams in live, and can be copied or opened straight in WhatsApp. Session stats count how many requests stayed on the device.

ShopMate never invents prices, stock levels or policies. If a fact is missing it leaves a `[placeholder]` for the owner to fill in.

## How it uses Firebase

- **Firebase AI Logic** (`firebase/ai`), Gemini Developer API backend:
  - `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, inCloudParams: { model: "gemini-3.5-flash-lite" } })`
  - The user can switch modes in the UI: `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`.
  - `model.initializeDeviceModel(onProgress)` downloads Gemini Nano after a click, with a progress bar.
  - `generateContentStream()` streams the output; `response.inferenceSource` (`InferenceSource.ON_DEVICE` / `IN_CLOUD`) drives the badge and stats.
  - Multimodal input (text plus a JPEG/PNG product photo).
- **Firebase App Check** with the reCAPTCHA Enterprise provider protects the AI endpoint. A debug-token mode is available for local testing and judging.

All AI calls are in [`app.js`](app.js).

## Run it

1. Create a Firebase project, enable **Firebase AI Logic** with the **Gemini Developer API**, and register a web app.
2. Copy `firebase-config.example.js` to `firebase-config.js` and paste your web config. For production, add a reCAPTCHA Enterprise site key registered in **App Check**.
3. Serve the folder over HTTP, e.g. `npx serve .` or `python3 -m http.server 8080`, and open it in Chrome.
4. For on-device AI, use **Chrome 139+** and enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, then restart Chrome. In the app, click **Prepare on-device model**.
5. Testing without a reCAPTCHA key: leave `appCheckSiteKey` empty. The App Check SDK prints a debug token in the console; register it in Firebase console → App Check → Apps → Manage debug tokens.

No build step: the app uses the Firebase JS SDK (v13.4.0) as ES modules from Google's CDN.

## Tech

Vanilla HTML/CSS/JS · Firebase JS SDK 13.4.0 · Firebase AI Logic (hybrid inference) · Gemini Nano (Chrome Prompt API) · Gemini 3.5 Flash-Lite (cloud) · Firebase App Check

## License

Apache-2.0. See [LICENSE](LICENSE).

Made by Abdulgafar Saad ([@saad_abdulgafar](https://x.com/saad_abdulgafar)), SAAD AI Automation.
