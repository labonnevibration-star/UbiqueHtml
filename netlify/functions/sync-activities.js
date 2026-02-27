exports.handler = async () => {
  try {

    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;
    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!gsUrl || !writeKey) {
      return { statusCode: 500, body: "Missing env vars" };
    }

    // 1️⃣ Get Athletes from Google Sheet
    const athletesRes = await fetch(gsUrl + "?mode=getAthletes");
    const athletesData = await athletesRes.json();

    const athletes = athletesData.athletes || [];

    let synced = 0;

    for (const athlete of athletes) {

      // 2️⃣ Refresh access_token
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id,
          client_secret,
          grant_type: "refresh_token",
          refresh_token: athlete.refresh_token
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) continue;

      const access_token = tokenData.access_token;

      // 3️⃣ Get activities (last 10)
      const activitiesRes = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=10",
        {
          headers: { Authorization: `Bearer ${access_token}` }
        }
      );

      const activities = await activitiesRes.json();
      if (!Array.isArray(activities)) continue;

      for (const act of activities) {

        const distance_km = act.distance / 1000;

        // 4️⃣ Save to Sheet
        await fetch(gsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: writeKey,
            mode: "saveActivity",
            email: athlete.email,
            athlete_id: athlete.athlete_id,
            activity_id: act.id,
            date: act.start_date,
            distance_km: distance_km
          })
        });

      }

      synced++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, synced })
    };

  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
