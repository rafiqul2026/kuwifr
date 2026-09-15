// server/scripts/verify-business-date.js
//
// Verifies server/src/utils/businessDate.js — specifically the midnight IST
// transition (the exact instant a "business day" rolls over), plus week/
// month/year boundaries. Run any time with:
//   node server/scripts/verify-business-date.js
// Exits non-zero if any assertion fails, so it can be wired into CI later
// if a test runner is ever added to this project.
const {
  getBusinessDayStart,
  getBusinessDayEnd,
  getBusinessWeekStart,
  getBusinessMonthStart,
  getBusinessMonthEnd,
  getPreviousBusinessMonthStart,
  getBusinessDateString,
  getBusinessMonthString
} = require('../src/utils/businessDate');

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  const a = actual instanceof Date ? actual.toISOString() : String(actual);
  const e = expected instanceof Date ? expected.toISOString() : String(expected);
  if (a === e) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}\n        expected: ${e}\n        actual:   ${a}`);
  }
}

console.log('=== Midnight IST transition ===');

// Sept 15, 2026, 23:59:59.999 IST = Sept 15 18:29:59.999 UTC
const justBeforeMidnight = new Date('2026-09-15T18:29:59.999Z');
assertEqual(getBusinessDateString(justBeforeMidnight), '2026-09-15', '23:59:59.999 IST on Sep 15 -> business date Sep 15');
assertEqual(getBusinessDayStart(justBeforeMidnight), new Date('2026-09-14T18:30:00.000Z'), '  -> day start = Sep 14 18:30 UTC (= Sep 15 00:00 IST)');
assertEqual(getBusinessDayEnd(justBeforeMidnight), new Date('2026-09-15T18:29:59.999Z'), '  -> day end = Sep 15 18:29:59.999 UTC (= Sep 15 23:59:59.999 IST)');

// Sept 16, 2026, 00:00:00.000 IST = Sept 15 18:30:00.000 UTC — the exact
// rollover instant. Everything at or after this must belong to Sep 16.
const exactMidnight = new Date('2026-09-15T18:30:00.000Z');
assertEqual(getBusinessDateString(exactMidnight), '2026-09-16', '00:00:00.000 IST rollover instant -> business date Sep 16 (new day starts)');
assertEqual(getBusinessDayStart(exactMidnight), exactMidnight, '  -> day start = itself (this instant IS Sep 16 00:00 IST)');

// One millisecond before/after the rollover must land on different business days.
const oneMsBefore = new Date(exactMidnight.getTime() - 1);
const oneMsAfter = new Date(exactMidnight.getTime() + 1);
assertEqual(getBusinessDateString(oneMsBefore), '2026-09-15', '1ms before rollover -> still Sep 15');
assertEqual(getBusinessDateString(oneMsAfter), '2026-09-16', '1ms after rollover -> already Sep 16');

// A UTC midnight (00:00:00 UTC) is 05:30 IST — mid-morning on the SAME IST
// calendar date, not a rollover. This is exactly the bug being fixed: the
// old server-local-time code would have rolled "today" over at UTC
// midnight instead of IST midnight.
const utcMidnight = new Date('2026-09-15T00:00:00.000Z'); // = Sep 15 05:30 IST
assertEqual(getBusinessDateString(utcMidnight), '2026-09-15', 'UTC midnight (05:30 IST) -> still Sep 15, NOT a rollover');

console.log('\n=== Week boundary (Monday-start) ===');
// Sept 14, 2026 is a Monday (IST). A timestamp on Sunday Sep 20 23:59 IST
// must still belong to the week starting Monday Sep 14.
const sundayLateIST = new Date('2026-09-20T18:00:00.000Z'); // Sep 20 23:30 IST (Sunday)
assertEqual(getBusinessWeekStart(sundayLateIST), new Date('2026-09-13T18:30:00.000Z'), 'Sunday 23:30 IST -> week start = Monday Sep 14 00:00 IST');
// The following Monday morning must roll into the NEXT week.
const nextMondayEarlyIST = new Date('2026-09-20T18:30:01.000Z'); // Sep 21 00:00:01 IST (Monday)
assertEqual(getBusinessWeekStart(nextMondayEarlyIST), new Date('2026-09-20T18:30:00.000Z'), "Monday 00:00:01 IST -> week start = itself's Monday (Sep 21)");

console.log('\n=== Month boundary ===');
// Aug 31, 2026 23:59:59.999 IST must be in August; Sep 1 00:00:00 IST rolls to September.
const augLastInstant = new Date('2026-08-31T18:29:59.999Z'); // Aug 31 23:59:59.999 IST
assertEqual(getBusinessMonthString(augLastInstant), '2026-08', 'Aug 31 23:59:59.999 IST -> month = 2026-08');
const sepFirstInstant = new Date('2026-08-31T18:30:00.000Z'); // Sep 1 00:00:00 IST
assertEqual(getBusinessMonthString(sepFirstInstant), '2026-09', 'Sep 1 00:00:00 IST -> month = 2026-09 (new month starts)');
assertEqual(getBusinessMonthStart(sepFirstInstant), sepFirstInstant, '  -> month start = itself');
assertEqual(getBusinessMonthEnd(augLastInstant), new Date('2026-08-31T18:29:59.999Z'), 'Aug month end = Aug 31 23:59:59.999 IST');
assertEqual(getPreviousBusinessMonthStart(sepFirstInstant), new Date('2026-07-31T18:30:00.000Z'), 'Previous month of Sep 1 = Aug 1 00:00 IST');

console.log('\n=== Year-boundary edge case (Dec 31 -> Jan 1) ===');
const newYearEveIST = new Date('2026-12-31T18:29:59.999Z'); // Dec 31 23:59:59.999 IST
assertEqual(getBusinessDateString(newYearEveIST), '2026-12-31', 'Dec 31 23:59:59.999 IST -> Dec 31');
const newYearIST = new Date('2026-12-31T18:30:00.000Z'); // Jan 1 00:00:00 IST 2027
assertEqual(getBusinessDateString(newYearIST), '2027-01-01', 'Jan 1 00:00:00 IST -> 2027-01-01');
assertEqual(getBusinessMonthStart(newYearIST), newYearIST, '  -> Jan month start = itself');

console.log('\n=== Live sanity check (current instant) ===');
const now = new Date();
console.log(`  Server clock (UTC):     ${now.toISOString()}`);
console.log(`  Business date (IST):    ${getBusinessDateString(now)}`);
console.log(`  Business day start:     ${getBusinessDayStart(now).toISOString()} UTC`);
console.log(`  Business day end:       ${getBusinessDayEnd(now).toISOString()} UTC`);
console.log(`  Business week start:    ${getBusinessWeekStart(now).toISOString()} UTC`);
console.log(`  Business month:         ${getBusinessMonthString(now)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
