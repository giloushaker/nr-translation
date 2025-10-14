import { initDB } from "../../util/mongo";
import { getAuthUser, generateToken, type MemberDocument } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  console.log(`🔄 Refresh permissions API: ${event.method} ${event.path}`);

  // Set CORS headers
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "POST, OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (event.method === "OPTIONS") {
    return "";
  }

  if (event.method !== "POST") {
    throw createError({
      statusCode: 405,
      statusMessage: "Method not allowed",
    });
  }

  // Get current user from JWT
  const user = getAuthUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  console.log(`🔄 Refreshing permissions for user: ${user.login}`);

  try {
    const mongo = await initDB();
    const collection = mongo.collection<MemberDocument>("members");

    // Fetch fresh user data from database
    const dbUser = await collection.findOne({ login: user.login });

    if (!dbUser) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found",
      });
    }

    // Generate new token with updated permissions
    const newToken = generateToken({
      userId: dbUser._id?.toString() || "",
      login: dbUser.login,
      translation_auth: dbUser.translation_auth || [],
      permission: dbUser.permission,
    });

    console.log(`✅ Permissions refreshed for user: ${user.login}`);

    return {
      success: true,
      token: newToken,
      user: {
        login: dbUser.login,
        translation_auth: dbUser.translation_auth || [],
        permission: dbUser.permission,
      },
    };
  } catch (error: any) {
    console.error("❌ Failed to refresh permissions:", error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to refresh permissions",
    });
  }
});
