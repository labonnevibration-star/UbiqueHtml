exports.handler = async (event) => {
  try {

    const qp = event.queryStringParameters || {};
    const code = qp.code;
    const state = qp.state;

    if (!code || !state) {
      return {
        statusCode: 400,
        body: "Missing code or state"
      };
    }

    const decoded = JSON.parse(
      Buffer.from(state, "base64").toString()
    );

    const email = (decoded.email || "").toLowerCase().trim();

    if (!email) {
      return {
        statusCode: 400,
        body: "Email missing in state"
      };
    }

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

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
        body: JSON.stringify(tokenData, null, 2)
      };
    }

    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    await fetch(gsUrl, {
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

    return {
      statusCode: 302,
      headers: {
        Location: "https://ubique.netlify.app/dashboard.html"
      }
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: e.message
    };
  }
};
