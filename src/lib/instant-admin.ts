import { init } from "@instantdb/admin";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN!;

const adminDb = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });

export { adminDb };
