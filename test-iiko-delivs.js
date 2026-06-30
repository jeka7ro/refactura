async function run() {
  const tokenRes = await fetch("https://api-eu.syrve.live/api/1/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiLogin: "124d0880f4b44717b69ee21d45fc2656" }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 3);

  const dFrom = start.toISOString().replace("T", " ").substring(0, 23);
  const dTo = now.toISOString().replace("T", " ").substring(0, 23);

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
        deliveryDateFrom: dFrom,
        deliveryDateTo: dTo,
      }),
    }
  );
  const data = await res.json();
  const orders = data?.ordersByOrganizations?.[0]?.orders || [];
  console.log("Orders count:", orders.length);
  if (orders.length > 0) {
    const o = orders[0];
    console.log(
      "Sample order:",
      JSON.stringify(
        {
          id: o.order.id,
          phone: o.order.phone,
          address: o.order.deliveryPoint?.address?.street?.name,
          sum: o.order.sum,
          orderTypeId: o.order.orderTypeId,
          orderType: o.order.orderType,
          created: o.creationInfo?.date,
          status: o.order.status,
        },
        null,
        2
      )
    );

    // Check all order type ids
    const typeIds = new Set(orders.map(or => or.order.orderTypeId));
    console.log("Order Type IDs:", Array.from(typeIds));
  }
}
run().catch(console.error);
