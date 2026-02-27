exports.handler = async () => {
  try {
    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;
    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!gsUrl || !writeKey || !client_id || !client_secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing env vars" })
      };
    }

    // 1️⃣ Get athletes from Apps Script
    const athletesRes = await fetch(gsUrl + "?mode=getAthletes");
    const athletesText = await athletesRes.text();

    let athletesJson;
    try {
      athletesJson = JSON.parse(athletesText);
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: "Apps Script did not return JSON",
          preview: athletesText.slice(0, 300)
        })
      };
    }

    const athletes = athletesJson.athletes || [];
    if (!Array.isArray(athletes)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Invalid athletes format" })
      };
    }

    let synced = 0;

    for (const athlete of athletes) {

      if (!athlete.refresh_token) continue;

      // 2️⃣ Refresh token
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id,
          client_secret,
          grant_type: "refresh_token",
          refresh_token: athlete.refresh_token
        })
      });

      const tokenText = await tokenRes.text();

      let tokenJson;
      try {
        tokenJson = JSON.parse(tokenText);
      } catch {
        continue;
      }

      if (!tokenRes.ok || !tokenJson.access_token) continue;

      const access_token = tokenJson.access_token;

      // 3️⃣ Get activities
      const activitiesRes = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=10",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const activitiesText = await activitiesRes.text();

      let activities;
      try {
        activities = JSON.parse(activitiesText);
      } catch {
        continue;
      }

      if (!Array.isArray(activities)) continue;

      for (const act of activities) {

        const distance_km = act.distance ? act.distance / 1000 : 0;

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
            distance_km
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
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, fatal: e.message })
    };
  }
};
