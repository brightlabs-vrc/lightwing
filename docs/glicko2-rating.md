# How Ratings Work

Lightwing calculates competitor **Ratings** on the Global Leaderboard and User Profiles using the **Glicko-2** rating system — the same foundation used by many competitive esports and racing leagues.

Your rating is designed to measure **skill and consistency over time**, taking into account who you raced against, how large the field was, and how regularly you compete.

---

## Starting Out

Every new competitor begins with:

- **Rating (`1500`)**: Your current skill estimate. Higher ratings reflect stronger performance against competitive fields.
- **Confidence Range (`±350`)**: Shown underneath your rating (for example, `1648 ±142`). A smaller `±` number means the system is more confident in your rating. As you complete more races, this range narrows.
- **Provisional Status (`?`)**: New competitors (fewer than 5 rated races or a wide confidence range) show a `?` indicator until they have enough race history for an established rating.

---

## How Races Affect Your Rating

After every official or community race with at least 2 active competitors, your rating updates based on your finish compared to every other runner in the field:

- **Beating higher-rated opponents** rewards more rating points than beating lower-rated opponents.
- **Losing to lower-rated opponents** costs more rating points than losing to higher-rated opponents.
- **Larger fields carry more weight**: Winning a 12-runner race earns a larger rating boost than winning a 2-runner race, without causing wild single-race swings.
- **Ties** are treated as an even split between tied competitors.

On your profile's **Career Overview** table, you can see your post-race rating and how much it changed in the **Rating Δ** column (for example, `1648 (+36)`).

---

## Special Race Statuses

Not every race ends cleanly. Here is how special statuses are handled:

- **Positioned Finishes (`#1`, `#2`, `#3`, ...)**: Ranked normally by finish position.
- **`DNF` (Did Not Finish) & `DSQ` (Disqualified)**: Counted as tied for last place behind everyone who finished the race.
- **`DNS` (Did Not Start) & `DEFERRED`**: Excluded from rating calculations — they will never help or hurt your rating.
- **Solo Races**: Races with fewer than 2 active competitors do not affect ratings.

---

## Seasons, Peak Rating & Taking a Break

- **Ratings Carry Over Across Seasons**: Your rating does not hard-reset at the start of a new calendar year. Instead, it continues smoothly from where you left off.
- **Season Change (`+` / `-`)**: On the Global Leaderboard, the colored number next to your confidence range shows how much rating you have gained or lost during the selected season year.
- **Peak Rating**: Your profile tracks the highest rating you have achieved over your career.
- **Returning After a Break**: If you step away from racing for a few weeks or an off-season, your rating itself stays the same — only your confidence range (`±`) widens slightly so that when you return, your rating can adjust more quickly to your current form.
