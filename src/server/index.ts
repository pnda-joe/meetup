import { getConfig } from "./config.js";
import { createApp } from "./app.js";
import { openDatabase, seedAdmin } from "./db.js";

const config = getConfig();
const db = openDatabase(config.databasePath);
await seedAdmin(db, config);

const app = createApp(db, config);
app.listen(config.port, () => {
  console.log(`Meetup app listening on port ${config.port}`);
});
