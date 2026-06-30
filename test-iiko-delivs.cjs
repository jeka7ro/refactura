const fetch = require("node-fetch");

async function run() {
  const tokenRes = await fetch("https://api-eu.syrve.live/api/1/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiLogin: "124d0880f4b44717b69ee21d45fc2656" }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  console.log("Token:", token);

  const res = await fetch(
    "https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationIds: ["9c63cff6-1d66-442d-a98d-2302656e3943"],
        deliveryDateFrom: "2024-01-01 00:00:00.000",
        deliveryDateTo: "2026-12-31 23:59:59.000",
      }),
    }
  );
  const data = await res.json();
  console.log("Orders count:", data?.orders?.length);
  if (data?.orders?.length > 0) {
    const o = data.orders[0];
    console.log(
      "Sample order:",
      JSON.stringify(
        {
          id: o.order.id,
          phone: o.order.phone,
          address: o.order.deliveryPoint?.address?.street?.name,
          sum: o.order.sum,
          orderType: o.order.orderType,
          created: o.creationInfo?.date,
          status: o.order.status,
        },
        null,
        2
      )
    );
  }
}
run().catch(console.error);
