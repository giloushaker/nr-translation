import { initDB } from "../../util/mongo";
import { hashPassword, generateToken, type MemberDocument, type JWTPayload } from "../../utils/auth";

interface RegisterRequest {
  login: string;
  password: string;
  translation_auth?: string[]; // Optional: array of game system IDs
}

export default defineEventHandler(async (event) => {
  console.log(`📝 Register API: ${event.method} ${event.path}`);

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
    const body = (await readBody(event)) as RegisterRequest;
    const { login, password, translation_auth = [] } = body;

    if (!login || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Login and password are required",
      });
    }

    if (password.length < 6) {
      throw createError({
        statusCode: 400,
        statusMessage: "Password must be at least 6 characters",
      });
    }

    const mongo = await initDB();
    const collection = mongo.collection<MemberDocument>("members");

    // Check if user already exists
    const existingUser = await collection.findOne({ login });

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: "User already exists",
      });
    }

    // Hash password using New Recruit method: hashPassword(login + "*" + password)
    const hashedPassword = hashPassword(`${login}*${password}`);

    // Create new user
    const newUser: MemberDocument = {
      login,
      password: hashedPassword,
      translation_auth,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newUser as any);

    // Generate JWT token
    const payload: JWTPayload = {
      userId: result.insertedId.toString(),
      login,
      translation_auth,
      permission: 0, // Default permission for new users
    };

    const token = generateToken(payload);

    console.log(`✅ Registration successful for user: ${login}`);

    return {
      success: true,
      token,
      user: {
        login,
        translation_auth,
        permission: 0,
      },
    };
  } catch (error: any) {
    console.error("❌ Registration failed:", error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Registration failed",
    });
  }
});
