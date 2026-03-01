// netlify/functions/strava-callback.js
exports.handler = async (event) => {
  try {
    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const stateB64 = qp.state;

    if (!code) return { statusCode: 400, body: "Missing code" };
    if (!stateB64) return { statusCode: 400, body: "Missing state" };

    // Decode state (email + handle optional)
    let state;
    try {
      state = JSON.parse(Buffer.from(stateB64, "base64").toString("utf8"));
    } catch (e) {
      return { statusCode: 400, body: "Invalid state" };
    }

    const email = (state.email || "").toString().trim().toLowerCase();
    const handle = (state.handle || "").toString().trim();

    if (!email) return { statusCode: 400, body: "Missing email in state" };

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      return { statusCode: 500, body: "Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET" };
    }

    // 1) Exchange code -> tokens
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData = {};
    try { tokenData = JSON.parse(tokenText); } catch {}

    if (!tokenRes.ok || !tokenData?.athlete?.id || !tokenData?.refresh_token) {
      return {
        statusCode: 400,
        body: JSON.stringify(
          { ok: false, step: "token_exchange_failed", status: tokenRes.status, tokenText },
          null,
          2
        ),
      };
    }

    // 2) Update Google Sheet
    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    if (!gsUrl || !writeKey) {
      return { statusCode: 500, body: "Missing GS_WEBAPP_URL / UBIQUE_WRITE_KEY" };
    }

    const payload = {
      key: writeKey,
      mode: "updateStravaToken",
      email,
      handle, // optionnel (si tu veux)
      athlete_id: tokenData.athlete.id,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at || "",
      updated_at: new Date().toISOString(),
    };

    const saveRes = await fetch(gsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const saveText = await saveRes.text();
    let saveJson = {};
    try { saveJson = JSON.parse(saveText); } catch {}

    if (!saveRes.ok || saveJson.ok !== true) {
      return {
        statusCode: 500,
        body: JSON.stringify(
          { ok: false, step: "sheet_update_failed", saveStatus: saveRes.status, saveText, payload },
          null,
          2
        ),
      };
    }

    // 3) Success page
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UBIQUE — Connecté</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#111827);font-family:system-ui;color:#e2e8f0}
  .card{width:min(520px,92vw);background:#1e293b;border-radius:22px;padding:44px 34px;text-align:center;box-shadow:0 40px 80px rgba(0,0,0,.55)}
  .badge{display:inline-block;padding:10px 14px;border-radius:999px;background:linear-gradient(90deg,#ff512f,#dd2476);font-weight:800}
  h1{margin:18px 0 8px;font-size:22px}
  p{margin:0;color:#94a3b8}
  a{display:inline-block;margin-top:22px;color:#fff;text-decoration:none;font-weight:800}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">🔥 UBIQUE</div>
    <h1>Strava connecté</h1>
    <p>Ton compte est synchronisé. Tu peux ouvrir le dashboard.</p>
    <a href="/dashboard.html">Aller au dashboard →</a>
  </div>
</body></html>`,
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err?.message || err}` };
  }
};
