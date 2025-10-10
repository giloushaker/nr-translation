import { initDB } from "../util/mongo";
import { getAuthUser, hasTranslationAuth, hasLanguageAuth } from "../utils/auth";

interface TranslationString {
  id: string;
  key: string;
  original: string;
  translation: string;
  translated: boolean;
  catalogue: string;
  modified?: boolean;
}

interface TranslationDocument {
  _id?: string;
  systemId: string;
  languageCode: string;
  key: string;
  original: string;
  translation: string;
  translated: boolean;
  catalogue: string;
  modified: boolean;
  lastUpdated: Date;
}

interface TranslationRequest {
  systemId: string;
  languageCode: string;
  translations?: TranslationString[];
}

export default defineEventHandler(async (event) => {
  console.log(`🎯 Translation API: ${event.method} ${event.path} from origin: ${event.node.req.headers["origin"]}`);

  // Set CORS headers
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "POST, OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");

  console.log("📡 Set API-level CORS headers");

  // Handle preflight OPTIONS request
  if (event.method === "OPTIONS") {
    console.log("✈️ Handling OPTIONS preflight request");
    return "";
  }

  const mongo = await initDB();
  const collection = mongo.collection<TranslationDocument>("translations");

  if (event.method === "POST") {
    try {
      console.log(`📨 Reading request body...`);
      const body = (await readBody(event)) as TranslationRequest;
      console.log(`📨 Raw body received:`, JSON.stringify(body, null, 2));

      const { systemId, languageCode, translations } = body;
      console.log(`📨 Extracted params:`, { systemId, languageCode, translationsLength: translations?.length });

      if (!systemId || !languageCode) {
        console.error(`❌ Missing required params: systemId=${systemId}, languageCode=${languageCode}`);
        throw createError({
          statusCode: 400,
          statusMessage: "systemId and languageCode are required",
        });
      }

      // If no translations array, this is a fetch request
      if (!translations || !Array.isArray(translations)) {
        console.log(
          `📖 No translations array provided - fetching existing translations for ${systemId}/${languageCode}`
        );

        // Check authentication for fetch
        const user = getAuthUser(event);

        if (!user) {
          console.error(`❌ Unauthorized: No valid JWT token provided`);
          throw createError({
            statusCode: 401,
            statusMessage: "Authentication required",
          });
        }

        if (!hasLanguageAuth(user, systemId, languageCode)) {
          console.error(`❌ Forbidden: User ${user.login} does not have permission for system ${systemId} language ${languageCode}`);
          throw createError({
            statusCode: 403,
            statusMessage: `You do not have permission to access translations for system: ${systemId}, language: ${languageCode}`,
          });
        }

        console.log(`✅ User ${user.login} authorized to fetch translations for ${systemId}/${languageCode}`);

        const documents = await collection
          .find({
            systemId,
            languageCode,
          })
          .toArray();

        const existingTranslations: TranslationString[] = documents.map((doc) => ({
          id: doc._id?.toString() || doc.key,
          key: doc.key,
          original: doc.original,
          translation: doc.translation,
          translated: doc.translated,
          catalogue: doc.catalogue,
          modified: doc.modified,
        }));

        console.log(`📖 Found ${existingTranslations.length} existing translations`);
        const response = { translations: existingTranslations };
        console.log(`📤 Sending fetch response with ${existingTranslations.length} translations`);
        return response;
      }

      console.log(`💾 Uploading ${translations.length} translations for ${systemId}/${languageCode}`);

      // Check authentication for upload
      const user = getAuthUser(event);

      if (!user) {
        console.error(`❌ Unauthorized: No valid JWT token provided`);
        throw createError({
          statusCode: 401,
          statusMessage: "Authentication required",
        });
      }

      if (!hasLanguageAuth(user, systemId, languageCode)) {
        console.error(`❌ Forbidden: User ${user.login} does not have permission for system ${systemId} language ${languageCode}`);
        throw createError({
          statusCode: 403,
          statusMessage: `You do not have permission to translate system: ${systemId}, language: ${languageCode}`,
        });
      }

      console.log(`✅ User ${user.login} authorized for ${systemId}/${languageCode}`);

      const operations = translations.map((translation) => ({
        replaceOne: {
          filter: {
            systemId,
            languageCode,
            key: translation.key,
          },
          replacement: {
            systemId,
            languageCode,
            key: translation.key,
            original: translation.original,
            translation: translation.translation,
            translated: translation.translated,
            catalogue: translation.catalogue,
            modified: translation.modified || false,
            lastUpdated: new Date(),
          },
          upsert: true,
        },
      }));

      if (operations.length > 0) {
        console.log(`🗃️ Executing ${operations.length} database operations...`);
        const result = await collection.bulkWrite(operations);
        console.log(`🗃️ Database result:`, {
          insertedCount: result.insertedCount,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          deletedCount: result.deletedCount,
          upsertedCount: result.upsertedCount,
        });
      } else {
        console.log(`⚠️ No operations to execute`);
      }

      console.log(`✅ Successfully uploaded ${translations.length} translations`);
      const response = { success: true, count: translations.length };
      console.log(`📤 Sending response:`, response);
      return response;
    } catch (error: any) {
      console.error("❌ Failed to upload translations:", error);
      console.error("❌ Error stack:", error.stack);
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to upload translations",
      });
    }
  }

  console.error(`❌ Method ${event.method} not allowed`);
  throw createError({
    statusCode: 405,
    statusMessage: "Method not allowed",
  });
});
