// server/src/utils/businessDate.js
//
// Centralized, authoritative IST (Asia/Kolkata, UTC+5:30, no DST) business-
// date utility. Every "Today"/"This Week"/"This Month" boundary anywhere in
// the app — member counts, income totals, business/KBP volume, daily/
// weekly/monthly income caps, franchise/withdrawal/salary stats — MUST go
// through this module instead of constructing its own `new Date()` boundary.
//
// WHY THIS EXISTS: before this file, every one of those calculations built
// its own "start of day" via the Node process's LOCAL timezone (`new Date(
// now.getFullYear(), now.getMonth(), now.getDate())`, `.setHours(0,0,0,0)`,
// etc.) — correct only if the server happens to run in IST. In production
// (Vercel serverless) that local timezone is UTC, so "Today" was silently
// rolling over at 05:30 IST instead of 00:00 IST, and three independent
// copies of the same Monday-start "week" formula existed across the
// codebase (income.service.js, report.service.js, user.controller.js).
//
// HOW THE MATH WORKS: IST has a fixed +5:30 offset with no DST, so instead
// of a heavy timezone library, this shifts a UTC instant forward by that
// fixed offset and reads the UTC-based Y/M/D/etc. component getters on the
// shifted value — which then equal what a clock on the wall in Kolkata
// would show. To go the other way (build the actual UTC instant for an IST
// calendar boundary), construct the boundary in UTC-based components and
// subtract the same offset.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30, fixed, no DST

/** Shifts a UTC instant forward by the IST offset so its UTC-based getters
 *  (getUTCFullYear, getUTCHours, etc.) read as if they were IST wall-clock
 *  getters. Internal helper — callers should use getISTParts() instead. */
function shiftToIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Returns the IST calendar/time components of `date` (default: now). */
function getISTParts(date = new Date()) {
  const shifted = shiftToIST(date);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-indexed, matches Date's own convention
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(), // 0 = Sunday .. 6 = Saturday, IST-correct
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds()
  };
}

/** The real UTC instant corresponding to 00:00:00.000 IST on the IST
 *  calendar date containing `date` — i.e. the start of the current IST
 *  business day. This is the ONE function every "Today" boundary in the
 *  app should be built from. */
function getBusinessDayStart(date = new Date()) {
  const p = getISTParts(date);
  return new Date(Date.UTC(p.year, p.month, p.date, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** 23:59:59.999 IST on the same business day — the closing instant of the
 *  IST calendar date containing `date`. Use as an inclusive upper bound
 *  ($lte) when a query needs a closed [start, end] range instead of an
 *  open-ended $gte-from-start-of-today. */
function getBusinessDayEnd(date = new Date()) {
  return new Date(getBusinessDayStart(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** { start, end } for the IST business day containing `date`. */
function getBusinessDayRange(date = new Date()) {
  return { start: getBusinessDayStart(date), end: getBusinessDayEnd(date) };
}

/** Start of the IST business day exactly `daysAgo` days before `date`'s
 *  business day (0 = today, 1 = yesterday, ...). Handy for "yesterday's
 *  totals" reporting without ever losing/deleting historical data — this
 *  only computes a read boundary, it never touches stored records. */
function getBusinessDayStartOffset(daysAgo, date = new Date()) {
  const todayStart = getBusinessDayStart(date);
  return new Date(todayStart.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

/** Monday-start IST week boundary — matches the Monday-start convention
 *  already used consistently everywhere in this codebase (previously three
 *  independent, slightly-differently-shaped copies of this exact formula:
 *  income.service.js#getWeekStart, report.service.js#getWeekStart, and an
 *  inline diff-to-Monday calculation in user.controller.js — all computing
 *  the same Monday, just each in local server time instead of IST). Sunday
 *  (day 0) is treated as the LAST day of the week it's in, not the first. */
function getBusinessWeekStart(date = new Date()) {
  const p = getISTParts(date);
  const diffToMonday = p.day === 0 ? -6 : 1 - p.day; // days to subtract to reach Monday
  const mondayDate = p.date + diffToMonday;
  return new Date(Date.UTC(p.year, p.month, mondayDate, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** Sunday 23:59:59.999 IST closing the week that getBusinessWeekStart()
 *  opened — the inclusive end of the IST business week containing `date`. */
function getBusinessWeekEnd(date = new Date()) {
  return new Date(getBusinessWeekStart(date).getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

/** Start of the IST calendar month containing `date`. */
function getBusinessMonthStart(date = new Date()) {
  const p = getISTParts(date);
  return new Date(Date.UTC(p.year, p.month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** Last instant (23:59:59.999 IST on the last calendar day) of the IST
 *  month containing `date`. */
function getBusinessMonthEnd(date = new Date()) {
  const p = getISTParts(date);
  // Day 0 of next month == last day of this month, in UTC-based Date math.
  return new Date(Date.UTC(p.year, p.month + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS);
}

/** Start of the IST calendar month immediately before the one containing
 *  `date` — e.g. for "previous month" salary/TTO settlement runs. */
function getPreviousBusinessMonthStart(date = new Date()) {
  const p = getISTParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** "YYYY-MM-DD" label for the IST business date containing `date` — for
 *  display, grouping keys, or API response "date" fields. Never used for
 *  query boundaries (use getBusinessDayStart/End for that). */
function getBusinessDateString(date = new Date()) {
  const p = getISTParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.date).padStart(2, '0')}`;
}

/** "YYYY-MM" label for the IST month containing `date` — matches
 *  salary.service.js's existing TTORecord/SalaryRecord month-key format,
 *  now IST-anchored instead of server-local. */
function getBusinessMonthString(date = new Date()) {
  const p = getISTParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`;
}

module.exports = {
  IST_OFFSET_MS,
  getISTParts,
  getBusinessDayStart,
  getBusinessDayEnd,
  getBusinessDayRange,
  getBusinessDayStartOffset,
  getBusinessWeekStart,
  getBusinessWeekEnd,
  getBusinessMonthStart,
  getBusinessMonthEnd,
  getPreviousBusinessMonthStart,
  getBusinessDateString,
  getBusinessMonthString
};
