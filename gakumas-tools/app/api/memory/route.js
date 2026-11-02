import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/auth";
import { connect } from "@/utils/mongodb";
import {
  MAX_MEMORIES_PER_USER,
  cleanMemories,
  readJsonBody,
} from "@/utils/apiValidation";
import { listMemories } from "@/utils/userLists";

const MAX_BODY_BYTES = 2_000_000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const { db } = await connect();
  return Response.json({ memories: await listMemories(db, userId) });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const { body, error, status } = await readJsonBody(request, MAX_BODY_BYTES);
  if (error) return new Response(error, { status });
  const memories = cleanMemories(body.memories);
  if (!memories) return new Response("Invalid memories", { status: 400 });

  const { db } = await connect();
  const collection = db.collection("memories");
  const count = await collection.countDocuments({ userId });
  if (count + memories.length > MAX_MEMORIES_PER_USER) {
    return new Response("Too many memories", { status: 409 });
  }
  const { insertedIds } = await collection.insertMany(
    memories.map((memory) => ({ userId, ...memory }))
  );

  return Response.json({ ids: Object.values(insertedIds) });
}
