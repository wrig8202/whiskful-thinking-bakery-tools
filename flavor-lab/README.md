# The Flavor Lab

*Where questionable ideas become very good cake pops.*

A self-contained, embeddable widget for Whiskful Thinking's Squarespace site.
Customers combine a base, a craving, a vibe, and a finish; a rule-based
generator invents a plausible cake pop concept from curated ingredient
pools (never a random word-mashup); customers vote ❤️ Absolutely or 🤔
Maybe, and can optionally "send it to the Lab" as a stronger nomination
signal. Everything — markup, styles, and behavior — lives in one file:
`flavor-lab/index.html`.

```
flavor-lab/
  index.html   — the entire widget (HTML + CSS + JS, self-contained)
  README.md    — this file
```

---

## 1. How the generator works (so it never sounds random)

The whole point of the Lab is that a result should make a bakery
professional think *"wait… I might actually make that."* That only works
if selections are filtered through real culinary logic instead of being
concatenated at random. Here's the pipeline, in order, every time someone
presses **Invent My Flavor**:

1. **Base affinity.** Each of the 4 bases (Vanilla, Chocolate, Lemon,
   Yellow Cake) has a weight for how well it suits each of the 5 cravings,
   *and* each individual ingredient in a craving's pool has its own
   per-base weight (0–3). A weight of 0 means "don't pair these" — e.g.
   Lemon + most candy flavors — and that pairing simply won't be offered
   under normal vibes.
2. **Weighted random pick (primary flavor).** `scoreCompatibility()`
   builds a weighted list from the chosen craving's pool (60 curated
   ingredients across the 5 cravings, ~12 each) using those weights, then
   picks one at random *weighted toward the better pairings*. This is why
   the same 4 selections can produce different — but always sensible —
   results on replay.
3. **Secondary/accent flavor.** Every primary flavor carries a "family"
   tag (berry, caramel, chocolateCookie, toasted, spice, etc.). 16 curated
   secondary components (creamy vanilla, cheesecake, brown butter, malt,
   dark chocolate ganache, pretzel, sea salt, and so on) each declare which
   families they complement. `scoreSecondary()` only offers secondaries
   that make sense with the chosen primary flavor's family.
4. **Finish ingredient.** White Chocolate and Milk Chocolate are coatings;
   Crunch and Crumble are texture toppings whose *specific* ingredient
   (graham crunch vs. pretzel crunch vs. cornflake crunch, etc.) is chosen
   the same family-matched way, so a berry flavor tends toward a graham or
   shortbread crumble rather than a pretzel crunch.
5. **The Weird-but-Good vibe** is the *only* vibe that can unlock an
   otherwise-excluded (weight 0) ingredient — and only ingredients
   explicitly tagged `weird: true` in the data (things like Mango, Rock
   Candy, Potato Chip Crunch). That's the guardrail that keeps "weird"
   experimental rather than nonsensical: nothing untagged is ever offered
   just because a customer picked Weird-but-Good.
6. **Naming.** `buildFlavorName()` first checks a curated
   `NAME_OVERRIDES` table (~30 hand-written, menu-ready names for known
   great pairings, like Blueberry + Creamy Vanilla → "Blueberry
   Cheesecake"). If there's no override, it falls back to a template
   (`Primary + Secondary's evocative name word`, e.g. "Truffle" instead of
   the literal "dark chocolate ganache"), then intelligently appends a
   texture word (Crunch/Crumble/Crisp/Cobbler) only if the finish calls for
   one and the name doesn't already imply texture.
7. **Personality line.** A one-sentence description is pulled from a pool
   of ~30 lines split across the 5 vibes plus a generic pool, with a
   light anti-repeat check against the last few lines shown.
8. **Lab Discovery (secret) flavors.** A handful of fully hand-written
   "signature" concepts (see `SECRET_DISCOVERIES` in the code) can
   surface instead of a procedural result, but only when a specific
   (undocumented, by design) combination of selections is made *and* a
   low-probability roll succeeds. This is what makes finding one feel
   like a real discovery rather than a guaranteed unlock.

Nothing in this pipeline is pure `Math.random()` concatenation — every
random choice is a *weighted* choice over a *curated* pool, which is the
"curated ingredients + compatibility weighting + procedural generation +
signature concepts" hybrid the whole system is built around.

---

## 2. Customization map — where to change things

Everything lives in `flavor-lab/index.html`. Search for these section
comments (they're numbered in the file):

| Want to change... | Look for... |
|---|---|
| **Colors, radius, shadows** | The `:root`-style block at the very top of the `<style>` tag, under `#whiskful-flavor-lab { --wt-background: ... }` — every color in the widget is built from these ~15 variables. |
| **Fonts** | The same block, `--wt-font-display` and `--wt-font-body`. System fonts only by default (no external requests); swap in a font your Squarespace template already loads if you want an exact match. |
| **Header/subhead copy, footer line** | The `<header class="wtfl-header">` markup and the `<p class="wtfl-footnote">` near the bottom of the widget markup. |
| **The 4 base/craving/vibe/finish options themselves** | `BASES`, `CRAVINGS`, `VIBES`, `FINISHES` objects in section 2 of the `<script>`. Adding a new option to any of these automatically shows up in the builder UI (`STEP_DEFS` reads from these objects). |
| **Ingredients within a craving** (e.g. add a 13th fruity flavor) | The `pool` array inside the relevant entry in `CRAVINGS`. Give it an `id`, `name`, `family`, and `aff` weight per base; add `weird: true` if it should be rare/experimental. |
| **Secondary/accent flavors** (creamy fillings, sauces, mix-ins) | The `SECONDARIES` array in section 2d. |
| **Coatings/crunches/crumbles** | The `pool` arrays inside `FINISHES` in section 2e. |
| **Garnish flourishes** | `GARNISH_POOL` in section 2f. |
| **Curated "menu-ready" name pairs** | `NAME_OVERRIDES` in section 3 — keyed `"primaryId|secondaryId"`. |
| **Secret Lab Discovery flavors** | `SECRET_DISCOVERIES` in section 3 — push a new object with a `match(selections)` function, a `chance` (0–1), and the full curated result. Nothing else needs to change to add one. |
| **Personality-line wording** | `PERSONALITY_GENERIC` and `PERSONALITY_BY_VIBE` in section 4. |
| **Loading messages, vote responses, nomination confirmations, builder taglines** | The microcopy arrays at the very top of the `<script>` (section 1: `BUILDER_TAGLINES`, `LOADING_MESSAGES`, `ABSOLUTELY_RESPONSES`, `MAYBE_RESPONSES`, `NOMINATION_CONFIRMATIONS`). |

Because ingredient pools, naming, and copy are all data (arrays/objects)
rather than hard-coded logic, most changes are additive — you're adding a
new object to an existing list, not rewriting a function.

---

## 3. Installing on Squarespace

You have two options. Both work; pick based on comfort level.

### Option A — Paste directly into a Code Block (simplest, no hosting)

1. Open `flavor-lab/index.html` in a text editor.
2. Copy everything between the two comments:
   `<!-- ============ SQUARESPACE COPY START ============ -->` and
   `<!-- ============ SQUARESPACE COPY END ============ -->`
   (this is the `<div id="whiskful-flavor-lab">...</div>` block, including
   its own `<style>` and `<script>` — you do **not** need the outer
   `<!DOCTYPE>`/`<head>`/`<body>` wrapper).
3. In Squarespace, add a **Code Block** to the page where you want the
   Lab to appear.
4. Paste the copied content into the Code Block and save.
5. That's it — no iframe, no separate hosting. The widget's styles are
   scoped entirely under `#whiskful-flavor-lab`, so it will not affect your
   site's navigation, fonts, buttons, or footer.

This is the recommended path if you don't want to manage separate
hosting. The only downside: updating the widget later means re-pasting
the updated block.

### Option B — Host it and embed with an iframe (easier to update later)

This mirrors how the other tool in this repo (`index.html` / the Baker's
Pricing Lab) is set up, and is worth it if you expect to keep tweaking the
Lab over time.

1. Push `flavor-lab/index.html` to a static host — GitHub Pages (this
   repo is already structured for it), Netlify Drop, or Cloudflare Pages
   all work with zero configuration.
2. You'll get a URL like `https://your-host/flavor-lab/`.
3. In Squarespace, add a **Code Block** with:
   ```html
   <iframe
       src="https://your-hosted-url-here/flavor-lab/"
       width="100%"
       height="1100"
       style="border:0; width:100%;"
       title="The Flavor Lab">
   </iframe>
   ```
4. Adjust `height` if the result card or vote panel gets cut off — 1100
   comfortably fits the tallest state (a voted result with the nomination
   block) at typical embed widths; go up to ~1300 on narrow mobile-width
   embeds.
5. To update later: edit `flavor-lab/index.html`, push the change, and the
   live embed updates automatically — nothing to re-paste.

---

## 4. Upgrading to real, cross-customer voting

**Today (V1):** votes, nominations, and the flavor DNA log are saved to
each visitor's own browser (`localStorage`). That's why the results panel
is honestly labeled "this device" — it reflects real activity, just not
shared across customers yet. This is intentional: it would be dishonest to
show a fake global percentage.

**Simplest real upgrade — Supabase.** Supabase gives you a hosted
Postgres database with an auto-generated REST API and a JS client, so
there's no backend server to write or run:

1. Create a free project at [supabase.com](https://supabase.com).
2. Create one table, `flavor_experiments`, with columns matching the DNA
   record shape already in the code (see `flavor-lab/index.html`, section
   8): `id, timestamp, recipe_key, flavor_name, build_description, base,
   craving, vibe, finish, primary_flavor, secondary_flavor, coating,
   topping, vote, lab_nomination, status`.
3. Turn on Row Level Security and add a policy allowing anonymous
   **INSERT** only (not update/delete) — visitors can log a vote, nobody
   can tamper with existing ones.
4. Add a small view or second table that sums votes per `recipe_key`, so
   reading totals is one lightweight query.
5. In `index.html`, replace the bodies of `getAggregateVotes()` and
   `recordVote()`/`nominateFlavor()` (all four functions are already
   isolated for exactly this swap — see the **DEVELOPER NOTES** comment
   block at the very bottom of the `<script>`) with calls to the Supabase
   JS client using your project's public anon key. That key is safe to
   expose client-side as long as step 3's policy is locked down.

Firebase/Firestore works almost identically if you're more comfortable
with that ecosystem. Full step-by-step detail (including exactly which
functions to touch and why) is written directly into the code — open
`index.html` and read the **"11. DEVELOPER NOTES"** comment at the bottom
of the `<script>` tag.

---

## 5. Viewing/exporting your own data

Once experiments are flowing into Supabase (or Firebase), the "owner's
table" — flavor, base, craving, vibe, finish, and vote/nomination counts —
is just a query or view on top of that table; every column it needs
already exists on the DNA record:

```
Flavor | Base | Craving | Vibe | Finish | Absolutely | Maybe | Nominations
```

- **Supabase:** the built-in Table Editor is a spreadsheet-like view with
  filtering/sorting and a one-click **Export to CSV** button — no SQL
  required, though a short grouped `SELECT` gets you the leaderboard shape
  above pre-summed if you want it.
- **Firebase:** the Firestore console lets you browse documents directly;
  a small export tool or script turns a collection into CSV.
- Either way, the resulting CSV opens directly in Excel or Google Sheets.

This is also the foundation for the analysis Whiskful Thinking eventually
wants: most popular base/craving/vibe/finish, best-performing ingredient
combinations, and a "Lab Favorites" leaderboard — all of it is a query
over data the widget is already structured to produce, once it's flowing
into a real database.

---

## 6. A note on the data model's future

The DNA record already includes a `status` field (`experimental` by
default) intended to eventually support `nominated`, `testing`,
`comingSoon`, and `madeReal` — so a flavor a customer helped invent could
someday be marked real and surfaced back to them ("You helped make this
real."). Nothing in V1 sets those other statuses automatically; that's a
deliberate, small future feature, not something this version needs to
build out.

---

### Accessibility & privacy notes

- Every choice is a real `<button>` with visible focus states and
  `aria-pressed`; the builder groups use `role="group"` with labels; the
  result card and loading state use `aria-live` so screen readers announce
  updates. Motion respects `prefers-reduced-motion`.
- No data leaves the visitor's browser in V1 — nothing is sent to
  Whiskful Thinking, this widget's host, or any third party unless/until
  you connect a database as described above.
