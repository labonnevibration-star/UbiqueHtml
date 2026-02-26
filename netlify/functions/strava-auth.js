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
        body: "strava-auth live. Missing ?code=... (open via the Strava authorize link).",
      };
    }

    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      return {
        statusCode: 500,
        body: "Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in Netlify env vars.",
      };
    }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Token exchange failed", data }, null, 2),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          ok: true,
          athlete_id: data.athlete?.id,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
        },
        null,
        2
      ),
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e?.message || e}` };
  }
};
