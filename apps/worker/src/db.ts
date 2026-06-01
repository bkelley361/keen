import { init, id } from "@instantdb/admin";

const APP_ID = process.env.INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN!;

const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });

export { db, id };
