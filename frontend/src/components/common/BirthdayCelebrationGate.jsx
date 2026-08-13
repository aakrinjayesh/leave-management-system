import { useEffect, useState } from "react";
import BirthdayCelebration from "./BirthdayCelebration";
import { useAuth } from "../../context/AuthContext";
import * as profileApi from "../../api/profile.api";

// Self-contained: mount this on any dashboard landing page and it decides for
// itself whether to play the birthday overlay - fires once per birthday (not
// on every visit that day), the first dashboard load after the year rolls
// over on lastBirthdayCelebratedYear.
export default function BirthdayCelebrationGate() {
  const { user, refreshUser } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!user?.birthDate) return;

    // birthDate is stored as midnight UTC of the calendar day picked, so UTC
    // getters give back exactly that day - matches the backend job's convention.
    const birth = new Date(user.birthDate);
    const now = new Date();
    const isBirthdayToday = birth.getUTCMonth() === now.getMonth() && birth.getUTCDate() === now.getDate();
    if (!isBirthdayToday) return;
    if (user.lastBirthdayCelebratedYear === now.getFullYear()) return;

    setShowCelebration(true);
    profileApi
      .markBirthdayCelebrationSeen()
      .then(() => refreshUser())
      .catch(() => {});
  }, [user?.birthDate, user?.lastBirthdayCelebratedYear]);

  if (!showCelebration) return null;
  return <BirthdayCelebration firstName={user?.firstName} onDone={() => setShowCelebration(false)} />;
}
