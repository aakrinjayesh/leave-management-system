// In-memory registry of open SSE connections, keyed by user id - lets
// notify()/notifyMany() wake up whichever tabs/devices a recipient currently
// has open instead of them waiting for the next poll. Purely additive: if
// this whole module did nothing, notifications would still be created and
// readable via the normal REST endpoints exactly as before - SSE is a
// delivery shortcut, never the source of truth. Single-process only (see
// notes on this in the leave-management memory) - a future multi-instance
// deployment would need a shared layer (Redis pub/sub) instead of this Map.
const connectionsByUserId = new Map();

const addConnection = (userId, res) => {
  if (!connectionsByUserId.has(userId)) connectionsByUserId.set(userId, new Set());
  connectionsByUserId.get(userId).add(res);
};

const removeConnection = (userId, res) => {
  const set = connectionsByUserId.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connectionsByUserId.delete(userId);
};

// Deliberately just a wake-up signal, not the notification data itself -
// notifyMany's bulk insert doesn't return per-row ids, so pushing an
// incomplete record risked the frontend trying to mark a real notification
// as read with an undefined id. The client re-fetches from the existing
// REST endpoints on receiving this, which is still effectively instant and
// guarantees it always has correct, complete data.
const pushToUser = (userId) => {
  const set = connectionsByUserId.get(userId);
  if (!set || set.size === 0) return;
  for (const res of set) {
    try {
      res.write("data: refresh\n\n");
    } catch (err) {
      console.error(`Failed to push SSE wake-up to user ${userId}:`, err);
    }
  }
};

module.exports = { addConnection, removeConnection, pushToUser };
