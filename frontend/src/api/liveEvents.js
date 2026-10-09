import { getNotificationStreamUrl } from "./notification.api";

// One shared SSE connection per tab, used by every component that wants live
// updates (notification bell, attendance roster, ...) instead of each one
// polling the API on a timer - an idle tab then costs no DB queries at all,
// which lets the Neon compute scale to zero.
//
// Events are wake-up signals only ("something changed, re-fetch"); the data
// itself always comes from the normal REST endpoints. Anything pushed while
// the connection was down is caught by `onResync`, which fires when the
// stream reconnects and when the user comes back to a tab that's been hidden
// for a while (in case the connection died without the browser noticing).

// Short tab switches don't need a re-sync - the stream was most likely open
// the whole time.
const RESYNC_AFTER_HIDDEN_MS = 60000;

let source = null;
let hasEverOpened = false;
let hiddenAt = null;
const subscribers = new Set();
const attachedEventNames = new Set();

const notifyResync = () => subscribers.forEach((sub) => sub.onResync?.());

const dispatch = (eventName) => (event) =>
  subscribers.forEach((sub) => sub.handlers[eventName]?.(event));

const attachEvent = (eventName) => {
  if (!source || attachedEventNames.has(eventName)) return;
  source.addEventListener(eventName, dispatch(eventName));
  attachedEventNames.add(eventName);
};

const openSource = () => {
  source = new EventSource(getNotificationStreamUrl(), { withCredentials: true });
  attachedEventNames.clear();
  subscribers.forEach((sub) => Object.keys(sub.handlers).forEach(attachEvent));

  // The very first open needs no re-sync (components load their own data on
  // mount); every later one means the stream was down and may have missed
  // pushes.
  source.onopen = () => {
    if (hasEverOpened) notifyResync();
    hasEverOpened = true;
  };
  // EventSource retries network errors on its own. It gives up for good on
  // a non-200 (e.g. session expired) - handleVisibilityChange reopens it the
  // next time the user returns to the tab.
  source.onerror = () => {};
};

const closeSource = () => {
  source?.close();
  source = null;
  hasEverOpened = false;
  attachedEventNames.clear();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  const wasHiddenLong = hiddenAt !== null && Date.now() - hiddenAt >= RESYNC_AFTER_HIDDEN_MS;
  hiddenAt = null;

  if (source?.readyState === EventSource.CLOSED) {
    closeSource();
    hasEverOpened = true; // so the reopen counts as a reconnect and re-syncs
    openSource();
    return;
  }
  if (wasHiddenLong) notifyResync();
};

// handlers: { [eventName]: fn } - "message" is the default (unnamed) event.
// onResync: called when data may have been missed and should be re-fetched.
// Returns an unsubscribe function; the connection closes once nobody is
// subscribed (e.g. on logout, when the dashboard layout unmounts).
export const subscribeLiveEvents = (handlers, onResync) => {
  const sub = { handlers, onResync };
  subscribers.add(sub);

  if (!source) {
    openSource();
    document.addEventListener("visibilitychange", handleVisibilityChange);
  } else {
    Object.keys(handlers).forEach(attachEvent);
  }

  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) {
      closeSource();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
};
