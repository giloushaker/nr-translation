import { initDB } from "../../util/mongo";
import { getAuthUser, isAdmin, type MemberDocument } from "../../utils/auth";
import { ObjectId } from "mongodb";

export default defineEventHandler(async (event) => {
  console.log(`👥 Admin Users API: ${event.method} ${event.path}`);

  // Set CORS headers
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (event.method === "OPTIONS") {
    return "";
  }

  // Check if user is admin (permission = 100)
  const user = getAuthUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  if (!isAdmin(user)) {
    console.error(`❌ Forbidden: User ${user.login} does not have admin permission (permission !== 100)`);
    throw createError({
      statusCode: 403,
      statusMessage: "Admin access required (permission = 100)",
    });
  }

  const mongo = await initDB();
  const collection = mongo.collection<MemberDocument>("members");

  if (event.method === "GET") {
    // Search users by login
    try {
      const query = getQuery(event);
      const search = (query.search as string) || "";

      if (!search || search.length < 2) {
        return {
          success: true,
          users: [],
          message: "Please enter at least 2 characters to search",
        };
      }

      console.log(`🔍 Searching users with: "${search}"`);

      // Build search filter - case-insensitive regex
      const filter = {
        login: { $regex: search, $options: "i" },
      };

      // Fetch matching users (limit to 100 results)
      const users = await collection
        .find(filter)
        .project({ password: 0 }) // Don't send passwords
        .sort({ login: 1 }) // Sort alphabetically
        .limit(100)
        .toArray();

      console.log(`✅ Found ${users.length} users matching "${search}"`);

      const response = {
        success: true,
        users: users.map((u) => ({
          _id: u._id?.toString(),
          login: u.login,
          translation_auth: u.translation_auth || [],
          permission: u.permission || 0,
          createdAt: u.createdAt,
        })),
      };

      console.log(`📤 Sending response with ${response.users.length} users`);
      return response;
    } catch (error) {
      console.error("❌ Failed to search users:", error);
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to search users",
      });
    }
  }

  if (event.method === "PUT") {
    // Update user permissions
    try {
      const body = await readBody(event);
      const { userId, translation_auth } = body;

      if (!userId || !translation_auth) {
        throw createError({
          statusCode: 400,
          statusMessage: "userId and translation_auth are required",
        });
      }

      const result = await collection.updateOne({ _id: new ObjectId(userId) }, { $set: { translation_auth } });

      if (result.matchedCount === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: "User not found",
        });
      }

      console.log(`✅ Updated permissions for user ${userId}`);

      return {
        success: true,
        message: "Permissions updated successfully",
      };
    } catch (error: any) {
      console.error("Failed to update user permissions:", error);
      if (error.statusCode) {
        throw error;
      }
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to update user permissions",
      });
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: "Method not allowed",
  });
});
