import { MongoClient, Db } from "mongodb";

export async function initDB(): Promise<Db> {
  // Init MongoDB
  const connectionString = process.env.NR_mongoConnectionString;
  const mongoName = process.env.NR_mongoName;

  if (connectionString && mongoName) {
    const mongoClient = await MongoClient.connect(connectionString, {});
    const mongodb = mongoClient.db(mongoName) as Db;

    console.log("* Initiating mongodb at " + mongoName);
    return mongodb;
  }
  throw "Failed to initialize database";
}
