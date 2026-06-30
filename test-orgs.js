async function run() {
  const tokenRes = await fetch("https://api-eu.syrve.live/api/1/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiLogin: "3ec9ef9d592440ea9039d6dae3e4a33f" }), // SushiMaster
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  const res = await fetch("https://api-eu.syrve.live/api/1/organizations", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      returnAdditionalInfo: true,
      includeDisabled: false,
    }),
  });
  const text = await res.text();
  console.log("Raw Organizations:", text);
}
run().catch(console.error);
