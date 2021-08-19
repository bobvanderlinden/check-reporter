import { Client } from "pg";

export async function connect() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });
  await client.connect();
  return client;
}

export async function use(fn: (client: Client) => Promise<void>) {
  const client = await connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}
