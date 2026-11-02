import {
  MAX_LOADOUTS_PER_USER,
  MAX_MEMORIES_PER_USER,
} from "./apiValidation";

const LIST_PROJECTION = { userId: 0 };

export function listLoadouts(db, userId) {
  return db
    .collection("loadouts")
    .find({ userId }, { projection: LIST_PROJECTION })
    .sort({ createdAt: -1 })
    .limit(MAX_LOADOUTS_PER_USER)
    .toArray();
}

export function listMemories(db, userId) {
  return db
    .collection("memories")
    .find({ userId }, { projection: LIST_PROJECTION })
    .limit(MAX_MEMORIES_PER_USER)
    .toArray();
}
