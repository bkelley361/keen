import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) throw new Error("UPSTASH_REDIS_URL is not set");

    connection = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });
  }
  return connection;
}
