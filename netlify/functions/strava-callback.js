exports.handler = async (event) => {
  try {

    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const error = qp.error;
    const state = qp.state;

    if (error) {
      return {
        statusCode: 400,
        body: `Strava error: ${error}`
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        body: "Missing ?code parameter."
      };
    }

    if (!state) {
      return {
        statusCode: 400,
        body: "Missing state parameter."
      };
    }

    // 🔥 Decode state (email inside)
    let decoded;
    try {
      decoded = JSON.parse(
        Buffer.from(state, "base64").toString()
      );
    } catch (e) {
      return {
        statusCode: 400,
        body: "Invalid state format."
      };
    }

    const email = decoded.email;

    if (!email) {
      return {
        statusCode: 400,
        body: "Missing email in state."
      };
    }

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      return {
        statusCode: 500,
        body: "Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET"
      };
    }

    // 🔥 Exchange code → tokens
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Token exchange failed",
          data: tokenData
        }, null, 2)
      };
    }

    // 🔥 Save to Google Sheets
    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    if (!gsUrl || !writeKey) {
      return {
        statusCode: 500,
        body: "Missing GS_WEBAPP_URL or UBIQUE_WRITE_KEY"
      };
    }

    const saveRes = await fetch(gsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: writeKey,
        email: email,
        handle: tokenData.athlete?.username || "",
        athlete_id: tokenData.athlete?.id,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        updated_at: new Date().toISOString()
      })
    });

    const saveJson = await saveRes.json().catch(() => ({}));

    if (!saveRes.ok || saveJson?.ok !== true) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed saving to Google Sheets",
          saveJson
        }, null, 2)
      };
    }

    // ✅ SUCCESS → Redirect to dashboard
    return {
      statusCode: 302,
      headers: {
        Location: "https://ubique.netlify.app/dashboard.html"
      }
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: `Server error: ${e?.message || e}`
    };
  }
};
