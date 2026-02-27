exports.handler = async () => {
  try {

    const gsUrl = process.env.GS_WEBAPP_URL;
    const writeKey = process.env.UBIQUE_WRITE_KEY;

    if (!gsUrl || !writeKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing GS env vars" })
      };
    }

    const res = await fetch(gsUrl + "?mode=getAthletes");
    const text = await res.text();

    return {
      statusCode: 200,
      body: JSON.stringify({
        step: "getAthletes",
        preview: text.slice(0,200)
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ fatal: e.message })
    };
  }
};
