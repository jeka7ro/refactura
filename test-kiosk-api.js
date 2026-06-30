async function run() {
  const res = await fetch("http://localhost:4000/api/kiosk-bridge/locations");
  const data = await res.json();
  console.log(
    data.map(l => ({ name: l.name, id: l.id, org: l.syrveOrganizationId }))
  );
}
run().catch(console.error);
