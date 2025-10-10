import { MongoClient, Db } from "mongodb";

// Singleton pattern - store the connection globally
let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;

export async function initDB(): Promise<Db> {
  // Return cached connection if it exists
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  // Init MongoDB
  const connectionString = process.env.NR_mongoConnectionString;
  const mongoName = process.env.NR_mongoName;

  if (!connectionString || !mongoName) {
    throw new Error("Failed to initialize database: missing connection string or database name");
  }

  try {
    // Create new connection
    const mongoClient = await MongoClient.connect(connectionString, {
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    const mongodb = mongoClient.db(mongoName) as Db;

    // Cache the connection
    cachedClient = mongoClient;
    cachedDb = mongodb;

    console.log("* MongoDB connected to " + mongoName);
    return mongodb;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error("Failed to initialize database");
  }
}
