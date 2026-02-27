exports.handler = async (event) => {
  try {
    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const error = qp.error;

    if (error) {
      return { statusCode: 400, body: `Strava error: ${error}` };
    }

    if (!code) {
      return {
        statusCode: 200,
        body: "strava-auth live. Missing ?code=...",
      };
    }

    // 🔥 Decode state (email + handle)
    if (!qp.state) {
      return {
        statusCode: 400,
        body: "Missing state parameter.",
      };
    }

    const decoded = JSON.parse(
      Buffer.from(qp.state, "base64").toString()
    );

    const email = decoded.email;
    const handle = decoded.handle || "";

    if (!email) {
      return {
        statusCode: 400,
        body: "Missing email in state parameter.",
      };
    }

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      return {
        statusCode: 500,
        body: "Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.",
      };
    }

    // 🔥 1) Exchange code → tokens
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();

    if (!res.ok || data?.errors) {
      return {
        statusCode: 400,
        body: JSON.stringify(
          { message: "Token exchange failed", data },
          null,
          2
        ),
      };
    }

    // 🔥 2) Save to Google Sheets
    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    if (!gsUrl || !writeKey) {
      return {
        statusCode: 500,
        body: "Missing GS_WEBAPP_URL / UBIQUE_WRITE_KEY.",
      };
    }

    const saveRes = await fetch(gsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: writeKey,
        email: email,
        handle: handle,                 // ✅ AJOUTÉ
        athlete_id: data.athlete?.id,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        updated_at: new Date().toISOString(),
      }),
    });

    const saveJson = await saveRes.json().catch(() => ({}));

    if (!saveRes.ok || saveJson?.ok !== true) {
      return {
        statusCode: 500,
        body: JSON.stringify(
          { message: "Failed saving to Google Sheets", saveJson },
          null,
          2
        ),
      };
    }

    // 🔥 3) Success page
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>UBIQUE — Connected</title>
<style>
body{
  margin:0;
  background:#0f172a;
  color:#e2e8f0;
  font-family:system-ui;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
}
.card{
  background:#1e293b;
  padding:60px;
  border-radius:20px;
  text-align:center;
  width:400px;
}
.check{
  font-size:48px;
  margin-bottom:20px;
}
h1{
  font-size:22px;
  margin-bottom:10px;
}
p{
  color:#94a3b8;
  font-size:14px;
}
</style>
</head>
<body>
<div class="card">
<div class="check">🔥</div>
<h1>Compte connecté</h1>
<p>Ton Strava est maintenant synchronisé.</p>
</div>
</body>
</html>
`
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: `Server error: ${e?.message || e}`,
    };
  }
};
