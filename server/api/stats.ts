import { initDB } from "../util/mongo";

interface TranslationStats {
  systemId: string;
  languages: Array<{
    languageCode: string;
    totalStrings: number;
    translatedStrings: number;
    modifiedStrings: number;
    completionPercentage: number;
    lastUpdated?: Date;
  }>;
  totalStrings: number;
  catalogues: Array<{
    name: string;
    stringCount: number;
  }>;
}

interface StatsRequest {
  systemId: string;
}

export default defineEventHandler(async (event) => {
  console.log(`📊 Stats API: ${event.method} ${event.path} from origin: ${event.node.req.headers["origin"]}`);

  // Set CORS headers
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");

  console.log("📡 Set API-level CORS headers");

  // Handle preflight OPTIONS request
  if (event.method === "OPTIONS") {
    console.log("✈️ Handling OPTIONS preflight request");
    return "";
  }

  const mongodb = await initDB();
  const collection = mongodb.collection("translations");

  if (event.method === "GET") {
    try {
      const query = getQuery(event);
      const systemId = query.systemId as string;

      console.log(`📊 GET query params:`, { systemId });

      if (!systemId) {
        throw createError({
          statusCode: 400,
          statusMessage: "systemId query parameter is required",
        });
      }

      console.log(`📊 Fetching stats for ${systemId}`);
    } catch (error) {
      console.error("Failed to fetch translation stats:", error);
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to fetch translation stats",
      });
    }
  } else if (event.method === "POST") {
    try {
      const body = (await readBody(event)) as StatsRequest;
      const { systemId } = body;

      console.log(`📊 POST body:`, { systemId });

      if (!systemId) {
        throw createError({
          statusCode: 400,
          statusMessage: "systemId is required",
        });
      }

      console.log(`📊 Fetching stats for ${systemId}`);
    } catch (error) {
      console.error("Failed to fetch translation stats:", error);
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to fetch translation stats",
      });
    }
  } else {
    throw createError({
      statusCode: 405,
      statusMessage: "Method not allowed",
    });
  }

  try {
    const query = getQuery(event);
    const body = event.method === "POST" ? ((await readBody(event)) as StatsRequest) : null;
    const systemId = (query.systemId as string) || body?.systemId;

    if (!systemId) {
      throw createError({
        statusCode: 400,
        statusMessage: "systemId is required",
      });
    }

    console.log(`📊 Processing stats for ${systemId}`);

    const pipeline = [
      { $match: { systemId } },
      {
        $group: {
          _id: {
            languageCode: "$languageCode",
            catalogue: "$catalogue",
          },
          totalStrings: { $sum: 1 },
          translatedStrings: {
            $sum: { $cond: [{ $eq: ["$translated", true] }, 1, 0] },
          },
          modifiedStrings: {
            $sum: { $cond: [{ $eq: ["$modified", true] }, 1, 0] },
          },
          lastUpdated: { $max: "$lastUpdated" },
        },
      },
      {
        $group: {
          _id: "$_id.languageCode",
          totalStrings: { $sum: "$totalStrings" },
          translatedStrings: { $sum: "$translatedStrings" },
          modifiedStrings: { $sum: "$modifiedStrings" },
          catalogues: {
            $push: {
              name: "$_id.catalogue",
              stringCount: "$totalStrings",
            },
          },
          lastUpdated: { $max: "$lastUpdated" },
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const languages = results.map((result: any) => ({
      languageCode: result._id,
      totalStrings: result.totalStrings,
      translatedStrings: result.translatedStrings,
      modifiedStrings: result.modifiedStrings,
      completionPercentage:
        result.totalStrings > 0 ? Math.round((result.translatedStrings / result.totalStrings) * 100) : 0,
      lastUpdated: result.lastUpdated,
    }));

    const allCatalogues = new Map<string, number>();
    let totalStrings = 0;

    results.forEach((result: any) => {
      result.catalogues.forEach((cat: any) => {
        const existing = allCatalogues.get(cat.name) || 0;
        allCatalogues.set(cat.name, Math.max(existing, cat.stringCount));
      });
      totalStrings = Math.max(totalStrings, result.totalStrings);
    });

    const catalogues = Array.from(allCatalogues.entries()).map(([name, stringCount]) => ({
      name,
      stringCount,
    }));

    const stats: TranslationStats = {
      systemId,
      languages,
      totalStrings,
      catalogues,
    };

    console.log(`📊 Returning stats: ${languages.length} languages, ${catalogues.length} catalogues`);
    return stats;
  } catch (error) {
    console.error("Failed to fetch translation stats:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch translation stats",
    });
  }
});
