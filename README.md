# RecipeFind App

A fully client-side recipe finder built with vanilla JavaScript, HTML, and CSS — no framework, no build tool, no backend. Data is persisted locally using **Dexie.js** (IndexedDB).

---

## Features

### Search
- Search recipes from two APIs simultaneously — **Forkify** and **TheMealDB**
- Forkify is tried first; if no results, falls back to MealDB automatically
- **Voice search** via the browser's Web Speech API (Chrome/Edge)
- **Search history** — last 10 searches shown in a dropdown on input focus, clickable to re-run
- **Surprise Me** — loads a random MealDB recipe instantly

### Recipe Detail Modal
- Recipe image, title, cook time / servings / publisher info
- Full ingredient list with quantities
- **Copy Ingredients** — copies the full list to clipboard in one click
- **Notes & Rating tab** — write personal notes and give a 1–5 star rating, saved per recipe
- **Save to Favorites** button
- **Add to Planner** button — opens a day/slot picker
- **Add to Shopping** button — dumps all ingredients into the shopping list
- Link to the original full recipe source

### Favorites
- Heart icon on every recipe card to save/unsave
- Dedicated **Favorites** filter button in the header — shows only saved recipes
- All favorites persist in IndexedDB

### Meal Planner
- Side panel with a **Mon–Sun × Breakfast/Lunch/Dinner** grid
- Add any open recipe to a specific day and meal slot
- Click a slot recipe to re-open its detail modal
- Remove individual slots with the × button

### Shopping List
- Side panel that collects ingredients from any recipe
- Check items off as you shop
- Delete individual items or clear all bought items at once with the broom button
- Groups items by recipe

### Food Reels
- Side panel where you paste **YouTube Shorts** or **Instagram Reels** links
- Video embeds directly in the panel
- For YouTube Shorts, the video title is fetched automatically and used to find matching recipes below the video
- Reels persist across page refreshes

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | Vanilla HTML + CSS |
| Logic | Vanilla JavaScript (ES2020+) |
| Database | [Dexie.js](https://dexie.org/) (IndexedDB wrapper) |
| Icons | Font Awesome 6 |
| Fonts | Google Fonts — Playfair Display + DM Sans |
| Recipe data | [Forkify API v2](https://forkify-api.jonas.io/) + [TheMealDB](https://www.themealdb.com/api.php) |

No Node.js, no bundler, no framework — open `index.html` directly in a browser.

---

## File Structure

```
RecipeFind/
├── index.html   # markup + layout
├── style.css    # all styles
├── app.js       # all UI logic and API calls
├── db.js        # Dexie database schema and helper functions
└── README.md
```

---

## Database Schema (Dexie / IndexedDB)

| Table | Primary Key | Description |
|---|---|---|
| `reels` | `id` | Saved YouTube / Instagram reels |
| `favorites` | `id` | Hearted recipes |
| `searchHistory` | `++id` | Search query log (max 20 entries) |
| `notes` | `recipeId` | Personal notes and star ratings per recipe |
| `mealPlan` | `[dayOfWeek+slot]` | Weekly meal planner entries |
| `shoppingList` | `++id` | Ingredient items with bought status |

---

## Running Locally

No installation needed. Just open the file:

```bash
# Option 1 — open directly
open index.html

# Option 2 — serve with any static server (avoids CORS on some browsers)
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (or just the file URL for option 1).

> **Note:** Voice search requires a browser that supports the Web Speech API (Chrome or Edge recommended). The app works fully offline for stored data; API searches require an internet connection.

---

## APIs Used

- **Forkify API v2** — `https://forkify-api.jonas.io/api/v2/recipes`
  - No API key required for basic search
- **TheMealDB** — `https://www.themealdb.com/api/json/v1/1`
  - Free tier, no API key required
- **YouTube oEmbed** — `https://www.youtube.com/oembed`
  - Used to fetch video titles from YouTube Shorts links, no key required
