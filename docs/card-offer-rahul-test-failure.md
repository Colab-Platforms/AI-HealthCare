# Card offer — "Rahul" test failure (scenario A)

> Status: **known failure, not fixed** (2026-11-16; updated 2026-11-17 — ab 2 tests fail). Shop changes se unrelated — card-offer (Shopify store buyers ko 30-day free trial) ka purana test.
> File: `server/tests/shopifyOfferRules.test.js` → test `A: on the 14-day trial, bought after joining -> +30 days after the trial ends (Rahul)`

## Scenario (Rahul)

| | Date |
|---|---|
| Rahul app pe join karta hai → 14-day `free_trial` shuru | 1 Nov 2026 |
| Rahul Shopify store se kharidta hai (join ke **baad**) | 4 Nov 2026 |
| Offer apply hota hai (test ka fixed "now") | 6 Nov 2026 |
| Trial khatam | 15 Nov 2026 |

**Rule A:** trial chal raha hai + join ke baad kharida → 30 din **trial ke end ke baad** jodo → access **15 Dec 2026** tak. Trial ki start date waisi hi rahe (`keepStart = true`).

## Kya fail ho raha hai

- Test expect karta hai: `kind = applied`, `end = 2026-12-15`, `keepStart = true`.
- Aaj (16 Nov 2026 se) mil raha hai: **rule C** — "trial khatam" maan ke `end = now + 30` (6 Dec) aur `keepStart = false`.
- **16 Nov se fail shuru hua** — 15 Nov (trial end) tak pass hota tha.

### 17 Nov update: doosra test bhi fail

Test `B, redeemed a few days after joining: still 30 days counted from joining` — user 2 Nov join, trial end **16 Nov**, order 1 Nov (join se pehle). Expect: rule B → `end = 2 Dec`. **17 Nov se** same wajah se trial "over" dikhta hai → rule C (`now + 30` = 6 Dec) → fail.

**Aage ka timeline (fix nahi kiya toh):**
| Date | Kaunsa test fail hoga |
|---|---|
| 16 Nov 2026 | A (Rahul) |
| 17 Nov 2026 | B, redeemed a few days after joining |
| 1 Dec 2026 | D (live paid plan → pending) — `currentPeriodEnd` 1 Dec |

(B "Priya" 20 Nov ke baad bhi pass rahega — wahan rule B aur C dono ka answer 6 Dec hi aata hai, sirf coincidence.)

## Root cause

`decideOffer(user, purchase, now, days)` ko test ek **fixed `now`** (6 Nov) deta hai. Lekin andar trial check:

```js
// server/services/shopifyOfferService.js  (decideOffer)
const trialRunning = sub.plan === TRIAL_PLAN_KEY && isEntitled(sub) && ...
```

aur `isEntitled` (`server/middleware/subscriptionAccess.js`) **asli ghadi** use karta hai:

```js
return !sub.currentPeriodEnd || sub.currentPeriodEnd > new Date();   // passed `now` ignore
```

Toh test ke liye "now" = 6 Nov, par `isEntitled` ke liye "now" = aaj (16 Nov) → trial end (15 Nov) nikal chuka → trial "over" → rule C.

`hasActivePaidPlan` bhi `isEntitled(sub)` bina `now` ke call karta hai → rule D ke tests (`currentPeriodEnd = 1 Dec 2026`) bhi **1 Dec 2026 ke baad** isi wajah se fail honge.

## Production pe asar?

**Nahi.** Prod mein `claimAndGrant` / `applyPendingCredits` `now = new Date()` hi pass karte hain — dono ghadi same hain, result sahi. Ye sirf **test time-dependent** hone ki problem hai (ek function do alag "now" dekh raha hai).

## Fix (proposed, abhi kiya nahi — card-offer owner decide kare)

1. `isEntitled(sub, now = new Date())` — default se baaki callers (middleware) waise hi chalenge.
2. `decideOffer` aur `hasActivePaidPlan` mein `isEntitled(sub, now)` pass karo.
3. Test dobara chalao: `node --test tests/shopifyOfferRules.test.js` (server/ se) → saare pass, aur date badalne se kabhi fail nahi.

Chhota, backward-compatible change; middleware ka behaviour same rehta hai.
