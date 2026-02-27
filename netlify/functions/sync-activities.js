exports.handler = async () => {
  try {

    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;
    const client_id = process.env.STRAVA_CLIENT_ID;
    const client_secret = process.env.STRAVA_CLIENT_SECRET;

    if (!gsUrl || !writeKey || !client_id || !client_secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok:false, error:"Missing env vars" })
      };
    }

    // 1️⃣ Get athletes safely
    const athletesRes = await fetch(gsUrl + "?mode=getAthletes");
    const text = await athletesRes.text();

    let athletesData;
    try {
      athletesData = JSON.parse(text);
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok:false,
          error:"Apps Script did not return JSON",
          preview:text.slice(0,300)
        })
      };
    }

    const athletes = athletesData.athletes || [];
    if (!Array.isArray(athletes)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok:false, error:"Invalid athletes format" })
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
        }),
      });

      const tokenText = await tokenRes.text();
      let tokenData;
      try {
        tokenData = JSON.parse(tokenText);
      } catch {
        continue;
      }

      if (!tokenRes.ok || !tokenData.access_token) continue;

      const access_token = tokenData.access_token;

      // 3️⃣ Fetch activities safely
      const activitiesRes = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=10",
        {
          headers: { Authorization: `Bearer ${access_token}` }
        }
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
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, fatal:e.message })
    };
  }
};
