exports.handler = async (event) => {

  const email = event.queryStringParameters?.email;

  if (!email) {
    return { statusCode: 400, body: "Missing email" };
  }

  const client_id = process.env.STRAVA_CLIENT_ID;
  const redirect_uri = process.env.STRAVA_REDIRECT_URI;

  const state = Buffer.from(JSON.stringify({ email }))
    .toString("base64");

  const url =
    "https://www.strava.com/oauth/authorize" +
    "?client_id=" + client_id +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(redirect_uri) +
    "&approval_prompt=force" +
    "&scope=activity:read_all" +
    "&state=" + state;

  return {
    statusCode: 302,
    headers: { Location: url }
  };
};
