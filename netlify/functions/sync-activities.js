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

    // 🔥 1. GET ATHLETES
    const athletesRes = await fetch(gsUrl + "?mode=getAthletes");
    const athletesJson = await athletesRes.json();
    const athletes = athletesJson.athletes || [];

    const allActivities = [];

    // 🔥 2. LOOP ATHLETES
    for (const athlete of athletes) {

      if (!athlete.refresh_token) continue;

      // Refresh token
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

      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.access_token) continue;

      const access_token = tokenJson.access_token;

      // 🔥 Only recent activities (limit for speed)
      const activitiesRes = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=5",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const activities = await activitiesRes.json();
      if (!Array.isArray(activities)) continue;

      for (const act of activities) {
        if (!act.id) continue;

        allActivities.push({
          email: athlete.email,
          athlete_id: athlete.athlete_id,
          activity_id: act.id,
          date: act.start_date,
          distance_km: act.distance ? act.distance / 1000 : 0
        });
      }
    }

    // 🔥 3. SINGLE BATCH WRITE
    if (allActivities.length > 0) {
      await fetch(gsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: writeKey,
          mode: "saveActivitiesBatch",
          activities: allActivities
        })
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok:true,
        athletes: athletes.length,
        activities_sent: allActivities.length
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, fatal:e.message })
    };
  }
};
