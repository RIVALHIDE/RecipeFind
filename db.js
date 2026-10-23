// ─── RecipeFind Database (Dexie.js) ───────────────────────────────────────────
// All persistent state lives here. localStorage is no longer used.

const db = new Dexie("RecipeFind");

db.version(1).stores({
  // Food Reels saved by the user
  // id: "youtube-<videoId>" or "instagram-<videoId>"
  reels: "id, type, addedAt",

  // Recipes the user has hearted
  // id: composite e.g. "forkify::abc123" or "mealdb::52772"
  favorites: "id, title, addedAt",

  // Every search term the user has submitted
  searchHistory: "++id, query, searchedAt",

  // Per-recipe notes and star ratings (1-5)
  notes: "recipeId, updatedAt",

  // Meal plan: one row per (dayOfWeek, slot) combination
  // dayOfWeek: 0=Mon … 6=Sun   slot: "breakfast"|"lunch"|"dinner"
  mealPlan: "[dayOfWeek+slot], recipeId, title, image, addedAt",

  // Shopping list items (ingredients collected from recipes)
  shoppingList: "++id, recipeId, text, bought, addedAt",
});

// ── Reels ──────────────────────────────────────────────────────────────────────
const dbLoadReels      = ()          => db.reels.orderBy("addedAt").reverse().toArray();
const dbSaveReel       = (reel)      => db.reels.put({ ...reel, addedAt: Date.now() });
const dbDeleteReel     = (id)        => db.reels.delete(id);

// ── Favorites ─────────────────────────────────────────────────────────────────
const dbAddFavorite    = (recipe)    => db.favorites.put({ ...recipe, addedAt: Date.now() });
const dbRemoveFavorite = (id)        => db.favorites.delete(id);
const dbIsFavorite     = (id)        => db.favorites.get(id).then(Boolean);
const dbGetFavorites   = ()          => db.favorites.orderBy("addedAt").reverse().toArray();

// ── Search History ────────────────────────────────────────────────────────────
const dbLogSearch = async (query) => {
  // keep only the latest 20 unique queries
  const q = query.trim().toLowerCase();
  if (!q) return;
  // remove old duplicate entry if present
  await db.searchHistory.where("query").equalsIgnoreCase(q).delete();
  await db.searchHistory.add({ query: q, searchedAt: Date.now() });
  // trim to 20
  const all = await db.searchHistory.orderBy("searchedAt").toArray();
  if (all.length > 20) {
    const oldIds = all.slice(0, all.length - 20).map((r) => r.id);
    await db.searchHistory.bulkDelete(oldIds);
  }
};
const dbGetSearchHistory = () =>
  db.searchHistory.orderBy("searchedAt").reverse().limit(10).toArray();

// ── Notes & Ratings ───────────────────────────────────────────────────────────
const dbSaveNote = (recipeId, note, rating) =>
  db.notes.put({ recipeId, note, rating, updatedAt: Date.now() });
const dbGetNote  = (recipeId) => db.notes.get(recipeId);

// ── Meal Planner ──────────────────────────────────────────────────────────────
const dbSetMealSlot    = (dayOfWeek, slot, recipe) =>
  db.mealPlan.put({ dayOfWeek, slot, ...recipe, addedAt: Date.now() });
const dbClearMealSlot  = (dayOfWeek, slot) =>
  db.mealPlan.delete([dayOfWeek, slot]);
const dbGetMealPlan    = () => db.mealPlan.toArray();

// ── Shopping List ─────────────────────────────────────────────────────────────
const dbAddShoppingItems = (recipeId, items) =>
  db.shoppingList.bulkAdd(
    items.map((text) => ({ recipeId, text, bought: false, addedAt: Date.now() }))
  );
const dbGetShoppingList  = ()         => db.shoppingList.orderBy("addedAt").toArray();
const dbToggleBought     = async (id) => {
  const item = await db.shoppingList.get(id);
  if (item) await db.shoppingList.update(id, { bought: !item.bought });
};
const dbClearBought      = ()         =>
  db.shoppingList.filter((i) => i.bought).delete();
const dbClearShoppingList = ()        => db.shoppingList.clear();
const dbRemoveShoppingItem = (id)     => db.shoppingList.delete(id);
