import { initDB } from "../../util/mongo";
import { comparePassword, generateToken, type MemberDocument, type JWTPayload } from "../../utils/auth";

interface LoginRequest {
  login: string;
  password: string;
}

export default defineEventHandler(async (event) => {
  console.log(`🔐 Login API: ${event.method} ${event.path}`);

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

  try {
    const body = (await readBody(event)) as LoginRequest;
    const { login, password } = body;

    if (!login || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Login and password are required",
      });
    }

    const mongo = await initDB();
    const collection = mongo.collection<MemberDocument>("members");

    // Find user by login
    const user = await collection.findOne({ login });

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials",
      });
    }

    // Hash the provided password using New Recruit method: hashPassword(login + "*" + password)
    const hashedPassword = hashPassword(`${login}*${password}`);

    // Verify password with backward compatibility (direct hash or SHA256 of stored hash)
    const isValidPassword = comparePassword(hashedPassword, user.password);

    if (!isValidPassword) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid credentials",
      });
    }

    // Generate JWT token
    const payload: JWTPayload = {
      userId: user._id?.toString() || "",
      login: user.login,
      translation_auth: user.translation_auth || [],
      permission: user.permission,
    };

    const token = generateToken(payload);

    console.log(`✅ Login successful for user: ${login}`);

    return {
      success: true,
      token,
      user: {
        login: user.login,
        translation_auth: user.translation_auth,
        permission: user.permission,
      },
    };
  } catch (error: any) {
    console.error("❌ Login failed:", error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Login failed",
    });
  }
});
