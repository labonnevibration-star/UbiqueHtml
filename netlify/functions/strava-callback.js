exports.handler = async (event) => {

  try {

    const qp = event.queryStringParameters || {};
    const code = qp.code;

    if (!code) {
      return { statusCode: 400, body: "Missing code" };
    }

    const state = JSON.parse(
      Buffer.from(qp.state, "base64").toString()
    );

    const email = state.email;

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

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
        body: JSON.stringify(tokenData)
      };
    }

    // 2️⃣ Update Google Sheet
    await fetch(process.env.GS_WEBAPP_URL, {
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

    // 3️⃣ Success page
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
        <html>
        <body style="background:#111;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
          <div>
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
      body: err.message
    };
  }
};
