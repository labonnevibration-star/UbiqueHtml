exports.handler = async (event) => {
  try {

    const code = event.queryStringParameters?.code;
    const state = event.queryStringParameters?.state;

    if (!code || !state) {
      return { statusCode: 400, body: "Missing code or state" };
    }

    const decoded = JSON.parse(
      Buffer.from(state, "base64").toString()
    );

    const email = decoded.email;

    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      return { statusCode: 400, body: JSON.stringify(tokenData) };
    }

    await fetch(process.env.GS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.UBIQUE_WRITE_KEY,
        email: email.toLowerCase().trim(),
        handle: tokenData.athlete?.username || "",
        athlete_id: tokenData.athlete?.id,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        updated_at: new Date().toISOString()
      })
    });

    return {
      statusCode: 302,
      headers: {
        Location: "https://ubique.netlify.app/dashboard.html"
      }
    };

  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
