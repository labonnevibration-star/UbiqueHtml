exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const body = JSON.parse(event.body || "{}");

    const { email, first_name, last_name, handle } = body;

    if (!email || !first_name || !last_name || !handle) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok:false, error:"Missing fields" })
      };
    }

    const res = await fetch(process.env.GS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.UBIQUE_WRITE_KEY,
        mode: "createAthlete",
        email,
        first_name,
        last_name,
        handle
      })
    });

    const text = await res.text();

    return {
      statusCode: 200,
      body: text
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, error:err.message })
    };
  }
};
