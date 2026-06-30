const {
  PrismaClient,
} = require("/Users/eugeniucazmal/Downloads/dev_office/smart_kiosk/packages/backend/node_modules/@prisma/client");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:/Users/eugeniucazmal/Downloads/dev_office/smart_kiosk/packages/backend/data/kiosk.db",
    },
  },
});
async function run() {
  const locs = await prisma.location.findMany();
  console.log(
    locs.map(l => ({ name: l.name, id: l.id, syrve: l.syrveOrganizationId }))
  );
}
run().catch(console.error);
