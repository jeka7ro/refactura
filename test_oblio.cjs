require("dotenv").config();
async function run() {
  const email = process.env.OBLIO_EMAIL;
  const secret = process.env.OBLIO_API_SECRET;
  const cif = process.env.OBLIO_CIF;

  const tokenRes = await fetch("https://www.oblio.eu/api/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${email}&client_secret=${secret}`,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const listRes = await fetch(
    `https://www.oblio.eu/api/docs/invoice/list?cif=${cif}&limit=10&offset=0`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const listData = await listRes.json();
  const inv = listData.data.find(d => d.number === "0002");
  if (inv) console.log(JSON.stringify(inv, null, 2));
}
run();
