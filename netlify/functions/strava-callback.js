exports.handler = async (event) => {
  try {

    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const stateRaw = qp.state;

    if (!code || !stateRaw) {
      return {
        statusCode: 400,
        body: "Missing code or state"
      };
    }

    // 🔥 Decode state
    let state;
    try {
      state = JSON.parse(
        Buffer.from(stateRaw, "base64").toString()
      );
    } catch (e) {
      return {
        statusCode: 400,
        body: "Invalid state format"
      };
    }

    const email = state.email;

    if (!email) {
      return {
        statusCode: 400,
        body: "Missing email in state"
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

    // 1️⃣ Exchange code for tokens
    const tokenRes = await fetch(
      "https://www.strava.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id,
          client_secret,
          code,
          grant_type: "authorization_code"
        })
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify(tokenData, null, 2)
      };
    }

    // 🔥 Vérifie données Strava
    if (!tokenData.athlete || !tokenData.refresh_token) {
      return {
        statusCode: 500,
        body: "Invalid token response from Strava"
      };
    }

    // 2️⃣ Update Google Sheet
    const gsRes = await fetch(process.env.GS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.UBIQUE_WRITE_KEY,
        mode: "updateStravaToken",
        email: email,
        athlete_id: tokenData.athlete.id,
        refresh_token: tokenData.refresh_token
      })
    });

    const gsText = await gsRes.text();

    if (!gsRes.ok) {
      return {
        statusCode: 500,
        body: "Google Sheet update failed: " + gsText
      };
    }

    // 3️⃣ Success page
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
        <html>
        <body style="background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center">
            <h1>🔥 Compte connecté</h1>
            <p>Strava est maintenant synchronisé.</p>
          </div>
        </body>
        </html>
      `
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: "Server error: " + err.message
    };
  }
};
