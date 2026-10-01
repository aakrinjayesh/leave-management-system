import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// Reads `paramName` from the URL (e.g. an email's "?requestId=123" landing
// here after login) and, once `items` (the loaded list) contains a row whose
// id matches, scrolls that row into view. Wire the return values onto a
// table row: `ref={rowRef(item)}` and `className={isHighlighted(item) ?
// "row-highlighted" : ""}`. `notFound` is true once the list has loaded and
// the id genuinely isn't in it (withdrawn, no access, etc) - show an error
// for that rather than failing silently.
export function useHighlightFromQuery(paramName, items, getId = (item) => item.id) {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get(paramName);
  const highlightId = raw ? Number(raw) : null;
  const highlightRowRef = useRef(null);

  useEffect(() => {
    if (highlightId && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, items]);

  const rowRef = (item) => (highlightId && getId(item) === highlightId ? highlightRowRef : null);
  const isHighlighted = (item) => Boolean(highlightId) && getId(item) === highlightId;
  const notFound = Boolean(highlightId && items && !items.some((item) => getId(item) === highlightId));

  return { highlightId, rowRef, isHighlighted, notFound };
}
