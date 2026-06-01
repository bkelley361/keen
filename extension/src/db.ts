import { init, id, tx } from "@instantdb/core";

const APP_ID = "d6052470-68b6-4150-aa97-229b770e9e77";

export const db = init({ appId: APP_ID });
export { id, tx };
