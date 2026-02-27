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

    // 1) Get athletes
    const athletesRes = await fetch(gsUrl + "?mode=getAthletes");
    const athletesText = await athletesRes.text();

    let athletesJson;
    try {
      athletesJson = JSON.parse(athletesText);
    } catch {
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
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:"Invalid athletes format" }) };
    }

    let processed = 0;
    let saved = 0;
    const errors = [];

    for (const athlete of athletes) {
      try {
        if (!athlete.refresh_token) continue;

        // 2) Refresh token
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
        try { tokenJson = JSON.parse(tokenText); } catch { continue; }

        if (!tokenRes.ok || !tokenJson.access_token) {
          errors.push({ email: athlete.email, step: "refresh", preview: tokenText.slice(0,200) });
          continue;
        }

        const access_token = tokenJson.access_token;

        // 3) Get last activities
        const actsRes = await fetch(
          "https://www.strava.com/api/v3/athlete/activities?per_page=10",
          { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const actsText = await actsRes.text();
        let activities;
        try { activities = JSON.parse(actsText); } catch { continue; }

        if (!Array.isArray(activities)) {
          errors.push({ email: athlete.email, step: "activities", preview: actsText.slice(0,200) });
          continue;
        }

        // 4) Save each activity (dedupe handled in Apps Script)
        for (const act of activities) {
          const distance_km = act.distance ? act.distance / 1000 : 0;

          const saveRes = await fetch(gsUrl, {
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

          const saveText = await saveRes.text();
          let saveJson = {};
          try { saveJson = JSON.parse(saveText); } catch {}

          if (saveRes.ok && saveJson.ok === true) saved++;
        }

        processed++;
      } catch (err) {
        errors.push({ email: athlete?.email, step: "loop", error: String(err) });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, processed, saved, errors }, null, 2)
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, fatal:e.message }) };
  }
};
