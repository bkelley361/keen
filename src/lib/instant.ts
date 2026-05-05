import { init, id, tx } from "@instantdb/react";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;

const db = init({ appId: APP_ID });

export { db, id, tx };
