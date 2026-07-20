import { getInvoiceArchiveById } from "./server/db.ts";

async function check() {
  const result = await getInvoiceArchiveById(10, 1);
  console.log(JSON.stringify(result, null, 2));
}
check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
