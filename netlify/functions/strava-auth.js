exports.handler = async (event) => {
  try {
    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const error = qp.error;
    const decoded = JSON.parse(Buffer.from(qp.state, 'base64').toString());
const email = decoded.email;
const handle = decoded.handle; // 🔥 IMPORTANT

    if (error) {
      return { statusCode: 400, body: `Strava error: ${error}` };
    }

    if (!code) {
      return {
        statusCode: 200,
        body: "strava-auth live. Missing ?code=...",
      };
    }

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
        body: JSON.stringify({ message: "Token exchange failed", data }, null, 2),
      };
    }

    // 🔥 2) Save to Google Sheets (with email!)
    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    const saveRes = await fetch(gsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: writeKey,
        email: email, // 🔥 NOW LINKED
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

    // 🔥 3) Success
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          ok: true,
          email: email,
          athlete_id: data.athlete?.id,
          linked: true,
        },
        null,
        2
      ),
    };

  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e?.message || e}` };
  }
};
