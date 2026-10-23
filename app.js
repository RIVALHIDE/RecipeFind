// ─── API endpoints ────────────────────────────────────────────────────────────
const FORKIFY_URL = "https://forkify-api.jonas.io/api/v2/recipes";
const MEALDB_URL  = "https://www.themealdb.com/api/json/v1/1";

// ─── Normalizers ─────────────────────────────────────────────────────────────
const normalizeForkifyCard = (r) => ({
  id:        `forkify::${r.id}`,
  title:     r.title,
  image:     r.image_url,
  publisher: r.publisher,
  source:    "forkify",
});

const normalizeMealDBCard = (m) => ({
  id:        `mealdb::${m.idMeal}`,
  title:     m.strMeal,
  image:     m.strMealThumb,
  publisher: m.strArea ? `${m.strArea} Cuisine` : m.strCategory,
  source:    "mealdb",
});

// ─── State ────────────────────────────────────────────────────────────────────
const DEFAULT_QUERY   = "pizza";
let   currentRecipeId = null;   // composite id of the recipe open in the modal
let   currentRating   = 0;      // star rating being edited in the notes tab
let   showingFavs     = false;  // whether the favorites filter is active
// store last fetched ingredient texts so "Add to Shopping" can read them
let   currentIngredients = [];

// ─── Render cards ────────────────────────────────────────────────────────────
const renderCards = async (recipes) => {
  if (!recipes.length) return "";
  // fetch which recipes are already favorited
  const favIds = new Set((await dbGetFavorites()).map((f) => f.id));

  return recipes.map((r) => `
    <div class="recipe-card" onclick="getRecipeById('${r.id}')">
      <div class="card-img-wrap">
        <img src="${r.image}" alt="${r.title}"
             onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'" />
        <button class="heart-btn ${favIds.has(r.id) ? "hearted" : ""}"
                onclick="event.stopPropagation(); toggleFavoriteCard('${r.id}', '${r.title.replace(/'/g, "\\'")}', '${r.image}', this)"
                title="${favIds.has(r.id) ? "Remove from favorites" : "Save to favorites"}">
          <i class="fas fa-heart"></i>
        </button>
      </div>
      <div class="card-body">
        <p><i class="fas fa-utensils"></i> ${r.publisher}</p>
        <div class="card-footer-row">
          <span class="publisher-tag">${r.publisher}</span>
          <button class="view-btn">View →</button>
        </div>
      </div>
    </div>
  `).join("");
};

// ─── Home / Search ────────────────────────────────────────────────────────────
const setBackBtn = (visible) =>
  document.getElementById("back-btn").style.display = visible ? "flex" : "none";

const getAllRecipes = async (query = DEFAULT_QUERY) => {
  showingFavs = false;
  document.getElementById("fav-filter-btn").classList.remove("active");

  const grid       = document.getElementById("recipes-grid");
  const countLabel = document.getElementById("count-label");
  grid.innerHTML   = `<div class="msg"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
  countLabel.textContent = "";
  setBackBtn(query !== DEFAULT_QUERY);

  // log to DB (skip default query)
  if (query !== DEFAULT_QUERY) await dbLogSearch(query);

  try {
    const forkifyRes  = await fetch(`${FORKIFY_URL}?search=${encodeURIComponent(query)}`);
    const forkifyData = await forkifyRes.json();
    const forkifyList = forkifyData?.data?.recipes || [];

    if (forkifyList.length > 0) {
      const cards = forkifyList.map(normalizeForkifyCard);
      countLabel.textContent = `(${cards.length} results)`;
      grid.innerHTML = await renderCards(cards);
      return;
    }

    const mealRes  = await fetch(`${MEALDB_URL}/search.php?s=${encodeURIComponent(query)}`);
    const mealData = await mealRes.json();
    const mealList = mealData?.meals || [];

    if (mealList.length > 0) {
      const cards = mealList.map(normalizeMealDBCard);
      countLabel.textContent = `(${cards.length} results via TheMealDB)`;
      grid.innerHTML = await renderCards(cards);
      return;
    }

    grid.innerHTML = `<div class="msg"><i class="fas fa-circle-exclamation"></i> No recipes found for "<strong>${query}</strong>". Try a different name.</div>`;
  } catch (err) {
    console.error("Search error:", err);
    grid.innerHTML = `<div class="msg"><i class="fas fa-circle-exclamation"></i> Something went wrong. Please try again.</div>`;
  }
};

getAllRecipes("pizza");

const goHome = () => {
  document.getElementById("search-input").value = "";
  getAllRecipes(DEFAULT_QUERY);
};

const searchRecipes = () => {
  const query = document.getElementById("search-input").value.trim();
  if (query) getAllRecipes(query);
};

document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchRecipes();
});

// ─── Search History Dropdown ──────────────────────────────────────────────────
const showHistoryDropdown = async () => {
  const dropdown = document.getElementById("history-dropdown");
  const history  = await dbGetSearchHistory();
  if (!history.length) { dropdown.style.display = "none"; return; }

  dropdown.innerHTML = history.map((h) => `
    <div class="history-item" onmousedown="pickHistory('${h.query.replace(/'/g,"\\'")}')">
      <i class="fas fa-clock-rotate-left"></i> ${h.query}
    </div>
  `).join("");
  dropdown.style.display = "block";
};

const hideHistoryDropdown = () => {
  // small delay so mousedown on an item fires first
  setTimeout(() => {
    document.getElementById("history-dropdown").style.display = "none";
  }, 150);
};

const pickHistory = (query) => {
  document.getElementById("search-input").value = query;
  getAllRecipes(query);
};

// ─── Favorites ────────────────────────────────────────────────────────────────
const toggleFavoriteCard = async (id, title, image, btn) => {
  const isFav = await dbIsFavorite(id);
  if (isFav) {
    await dbRemoveFavorite(id);
    btn.classList.remove("hearted");
    btn.title = "Save to favorites";
  } else {
    await dbAddFavorite({ id, title, image, publisher: "" });
    btn.classList.add("hearted");
    btn.title = "Remove from favorites";
  }
  // keep modal fav button in sync if same recipe is open
  if (currentRecipeId === id) await syncModalFavBtn();
};

const toggleFavoritesFilter = async () => {
  showingFavs = !showingFavs;
  const btn = document.getElementById("fav-filter-btn");
  btn.classList.toggle("active", showingFavs);

  if (!showingFavs) {
    getAllRecipes(DEFAULT_QUERY);
    return;
  }

  const grid       = document.getElementById("recipes-grid");
  const countLabel = document.getElementById("count-label");
  grid.innerHTML   = `<div class="msg"><i class="fas fa-spinner fa-spin"></i> Loading favorites...</div>`;

  const favs = await dbGetFavorites();
  setBackBtn(false);
  countLabel.textContent = "";

  if (!favs.length) {
    grid.innerHTML = `<div class="msg"><i class="fas fa-heart-crack"></i> No favorites yet. Heart a recipe to save it here.</div>`;
    return;
  }

  countLabel.textContent = `(${favs.length} favorites)`;
  grid.innerHTML = await renderCards(favs);
};

// ─── Modal ────────────────────────────────────────────────────────────────────
const openModal  = () => document.getElementById("modal").classList.add("open");
const closeModal = () => {
  document.getElementById("modal").classList.remove("open");
  currentRecipeId      = null;
  currentIngredients   = [];
  currentRating        = 0;
};

const clearModal = () => {
  document.getElementById("modal-img").src               = "";
  document.getElementById("modal-title").textContent     = "";
  document.getElementById("modal-info").innerHTML        =
    `<div class="info-pill"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
  document.getElementById("modal-ingredients").innerHTML = "";
  document.getElementById("modal-source").href           = "#";
  document.getElementById("modal-source").style.display = "";
  // reset tabs to ingredients
  switchTab("ingredients", document.querySelector('.modal-tab[data-tab="ingredients"]'));
  // reset notes pane
  document.getElementById("note-input").value    = "";
  document.getElementById("note-saved-msg").style.display = "none";
  setRating(0);
};

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});

// ─── Modal tabs ───────────────────────────────────────────────────────────────
const switchTab = (tab, btn) => {
  document.querySelectorAll(".modal-tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach((p) => p.style.display = "none");
  if (btn) btn.classList.add("active");
  document.getElementById(`tab-${tab}`).style.display = "";

  // load notes when switching to that tab
  if (tab === "notes" && currentRecipeId) loadNotePane(currentRecipeId);
};

// ─── Recipe detail ────────────────────────────────────────────────────────────
const getRecipeById = async (compositeId) => {
  openModal();
  clearModal();
  currentRecipeId    = compositeId;
  currentIngredients = [];

  const [source, id] = compositeId.split("::");
  try {
    if (source === "forkify") await loadForkifyDetail(id);
    else                       await loadMealDBDetail(id);
  } catch (err) {
    console.error("Detail error:", err);
  }

  await syncModalFavBtn();
};

const syncModalFavBtn = async () => {
  if (!currentRecipeId) return;
  const isFav  = await dbIsFavorite(currentRecipeId);
  const label  = document.getElementById("fav-btn-label");
  const favBtn = document.getElementById("fav-btn");
  label.textContent = isFav ? "Saved ♥" : "Save to Favorites";
  favBtn.classList.toggle("fav-active", isFav);
};

const toggleFavoriteFromModal = async () => {
  if (!currentRecipeId) return;
  const isFav = await dbIsFavorite(currentRecipeId);
  if (isFav) {
    await dbRemoveFavorite(currentRecipeId);
  } else {
    const title = document.getElementById("modal-title").textContent;
    const image = document.getElementById("modal-img").src;
    await dbAddFavorite({ id: currentRecipeId, title, image, publisher: "" });
  }
  await syncModalFavBtn();
  // refresh heart icon on the card in the grid if visible
  const cardHeartBtns = document.querySelectorAll(`.heart-btn`);
  cardHeartBtns.forEach((btn) => {
    const card = btn.closest(".recipe-card");
    if (card && card.getAttribute("onclick")?.includes(currentRecipeId)) {
      const nowFav = !isFav;
      btn.classList.toggle("hearted", nowFav);
    }
  });
};

// ─── Copy ingredients ─────────────────────────────────────────────────────────
const copyIngredients = () => {
  if (!currentIngredients.length) return;
  const text = currentIngredients.join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".copy-ingredients-btn");
    btn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
    setTimeout(() => {
      btn.innerHTML = `<i class="fas fa-copy"></i> Copy Ingredients`;
    }, 2000);
  });
};

// ─── Forkify detail ───────────────────────────────────────────────────────────
const loadForkifyDetail = async (id) => {
  const res    = await fetch(`${FORKIFY_URL}/${id}`);
  const data   = await res.json();
  const recipe = data?.data?.recipe;

  document.getElementById("modal-img").src           = recipe?.image_url;
  document.getElementById("modal-title").textContent = recipe?.title;
  document.getElementById("modal-source").href       = recipe?.source_url || "#";

  document.getElementById("modal-info").innerHTML = `
    <div class="info-pill"><i class="fas fa-clock"></i> ${recipe?.cooking_time} min</div>
    <div class="info-pill"><i class="fas fa-user"></i> ${recipe?.servings} servings</div>
    <div class="info-pill"><i class="fas fa-store"></i> ${recipe?.publisher}</div>
  `;

  currentIngredients = recipe?.ingredients.map(
    (ing) => `${ing?.quantity ? +ing.quantity.toFixed(2) : ""} ${ing?.unit} ${ing?.description}`.trim()
  ) || [];

  document.getElementById("modal-ingredients").innerHTML = currentIngredients.map((text) => `
    <li><i class="fas fa-check-circle"></i> ${text}</li>
  `).join("");
};

// ─── MealDB detail ────────────────────────────────────────────────────────────
const loadMealDBDetail = async (id) => {
  const res  = await fetch(`${MEALDB_URL}/lookup.php?i=${id}`);
  const data = await res.json();
  const m    = data?.meals?.[0];
  if (!m) return;

  document.getElementById("modal-img").src           = m.strMealThumb;
  document.getElementById("modal-title").textContent = m.strMeal;
  document.getElementById("modal-source").href       = m.strSource || "#";

  document.getElementById("modal-info").innerHTML = `
    ${m.strCategory ? `<div class="info-pill"><i class="fas fa-tag"></i> ${m.strCategory}</div>` : ""}
    ${m.strArea     ? `<div class="info-pill"><i class="fas fa-globe"></i> ${m.strArea}</div>`    : ""}
    ${m.strTags     ? `<div class="info-pill"><i class="fas fa-hashtag"></i> ${m.strTags.split(",")[0]}</div>` : ""}
  `;

  currentIngredients = [];
  for (let i = 1; i <= 20; i++) {
    const name    = m[`strIngredient${i}`];
    const measure = m[`strMeasure${i}`];
    if (name && name.trim()) {
      currentIngredients.push(`${measure ? measure.trim() : ""} ${name.trim()}`.trim());
    }
  }

  document.getElementById("modal-ingredients").innerHTML = currentIngredients.map((text) => `
    <li><i class="fas fa-check-circle"></i> ${text}</li>
  `).join("");

  if (!m.strSource) document.getElementById("modal-source").style.display = "none";
};

// ─── Notes & Ratings ──────────────────────────────────────────────────────────
const setRating = (val) => {
  currentRating = val;
  document.querySelectorAll("#star-rating span").forEach((s) => {
    s.classList.toggle("active", +s.dataset.v <= val);
  });
};

const loadNotePane = async (recipeId) => {
  const saved = await dbGetNote(recipeId);
  document.getElementById("note-input").value          = saved?.note   || "";
  document.getElementById("note-saved-msg").style.display = "none";
  setRating(saved?.rating || 0);
};

const saveNote = async () => {
  if (!currentRecipeId) return;
  await dbSaveNote(currentRecipeId, document.getElementById("note-input").value, currentRating);
  const msg = document.getElementById("note-saved-msg");
  msg.style.display = "block";
  setTimeout(() => msg.style.display = "none", 2500);
};

// ─── Meal Planner ─────────────────────────────────────────────────────────────
const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = ["breakfast","lunch","dinner"];

const togglePlannerPanel = async () => {
  const panel   = document.getElementById("planner-panel");
  const overlay = document.getElementById("planner-overlay");
  const isOpen  = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  overlay.classList.toggle("open", !isOpen);
  if (!isOpen) await renderPlanner();
};

const renderPlanner = async () => {
  const plan    = await dbGetMealPlan();
  const planMap = {};
  plan.forEach((p) => { planMap[`${p.dayOfWeek}-${p.slot}`] = p; });

  const body = document.getElementById("planner-body");
  body.innerHTML = DAYS.map((day, di) => `
    <div class="planner-day">
      <div class="planner-day-label">${day}</div>
      <div class="planner-slots">
        ${SLOTS.map((slot) => {
          const entry = planMap[`${di}-${slot}`];
          return `
            <div class="planner-slot ${entry ? "filled" : ""}">
              <span class="slot-label">${slot}</span>
              ${entry
                ? `<div class="slot-recipe" onclick="getRecipeById('${entry.recipeId}')">
                     <img src="${entry.image}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'" />
                     <span>${entry.title}</span>
                     <button class="slot-remove" onclick="event.stopPropagation();removePlanSlot(${di},'${slot}')">
                       <i class="fas fa-times"></i>
                     </button>
                   </div>`
                : `<div class="slot-empty">—</div>`
              }
            </div>`;
        }).join("")}
      </div>
    </div>
  `).join("");
};

const removePlanSlot = async (day, slot) => {
  await dbClearMealSlot(day, slot);
  await renderPlanner();
};

// plan picker — mini modal shown from inside recipe modal
const openPlanPicker = () => {
  if (!currentRecipeId) return;
  const grid = document.getElementById("plan-picker-grid");
  grid.innerHTML = DAYS.map((day, di) =>
    SLOTS.map((slot) => `
      <button class="picker-slot-btn" onclick="assignToPlan(${di},'${slot}')">
        <strong>${day.slice(0,3)}</strong><br/>${slot}
      </button>
    `).join("")
  ).join("");
  document.getElementById("plan-picker").style.display = "flex";
};

const closePlanPicker      = (e) => {
  if (e.target === document.getElementById("plan-picker"))
    document.getElementById("plan-picker").style.display = "none";
};
const closePlanPickerDirect = () =>
  document.getElementById("plan-picker").style.display = "none";

const assignToPlan = async (dayOfWeek, slot) => {
  const title = document.getElementById("modal-title").textContent;
  const image = document.getElementById("modal-img").src;
  await dbSetMealSlot(dayOfWeek, slot, { recipeId: currentRecipeId, title, image });
  closePlanPickerDirect();
  // show brief confirmation
  const btn = document.getElementById("plan-add-btn");
  btn.innerHTML = `<i class="fas fa-check"></i> Added!`;
  setTimeout(() => btn.innerHTML = `<i class="fas fa-calendar-plus"></i> Add to Planner`, 2000);
};

// ─── Shopping List ────────────────────────────────────────────────────────────
const toggleShopPanel = async () => {
  const panel   = document.getElementById("shop-panel");
  const overlay = document.getElementById("shop-overlay");
  const isOpen  = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  overlay.classList.toggle("open", !isOpen);
  if (!isOpen) await renderShopList();
};

const renderShopList = async () => {
  const items = await dbGetShoppingList();
  const body  = document.getElementById("shop-body");

  if (!items.length) {
    body.innerHTML = `<p class="shop-empty"><i class="fas fa-cart-shopping"></i> Your shopping list is empty.<br/>Open a recipe and tap "Add to Shopping".</p>`;
    return;
  }

  // group by recipeId (use first item's recipeId as label)
  const groups = {};
  items.forEach((item) => {
    if (!groups[item.recipeId]) groups[item.recipeId] = [];
    groups[item.recipeId].push(item);
  });

  body.innerHTML = Object.entries(groups).map(([, groupItems]) => `
    <div class="shop-group">
      <div class="shop-group-items">
        ${groupItems.map((item) => `
          <div class="shop-item ${item.bought ? "bought" : ""}" id="shop-item-${item.id}">
            <button class="shop-check" onclick="toggleShopItem(${item.id})">
              <i class="fas ${item.bought ? "fa-circle-check" : "fa-circle"}"></i>
            </button>
            <span class="shop-text">${item.text}</span>
            <button class="shop-delete" onclick="deleteShopItem(${item.id})">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
};

const addIngredientsToShopList = async () => {
  if (!currentIngredients.length || !currentRecipeId) return;
  await dbAddShoppingItems(currentRecipeId, currentIngredients);
  const btn = document.getElementById("shop-add-btn");
  btn.innerHTML = `<i class="fas fa-check"></i> Added!`;
  setTimeout(() => btn.innerHTML = `<i class="fas fa-cart-plus"></i> Add to Shopping`, 2000);
};

const toggleShopItem = async (id) => {
  await dbToggleBought(id);
  await renderShopList();
};

const deleteShopItem = async (id) => {
  await dbRemoveShoppingItem(id);
  await renderShopList();
};

const clearBoughtItems = async () => {
  await dbClearBought();
  await renderShopList();
};

// ─── Food Reels ────────────────────────────────────────────────────────────────
const parseYouTubeShortsId = (url) => {
  const m = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})/);
  return m ? (m[1] || m[2]) : null;
};

const parseInstagramReelId = (url) => {
  const m = url.match(/instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};

const fetchYouTubeTitle = async (videoId) => {
  try {
    const res  = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await res.json();
    return data?.title || null;
  } catch { return null; }
};

const extractDishFromTitle = (title) =>
  title
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\b(recipe|how to make|easy|quick|best|homemade|style|asmr|shorts|reels|viral|trending|pt\d?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase()
    .split(" ").slice(0, 4).join(" ");

const searchReelRecipes = async (query) => {
  const forkifyRes  = await fetch(`${FORKIFY_URL}?search=${encodeURIComponent(query)}`);
  const forkifyData = await forkifyRes.json();
  const forkifyList = forkifyData?.data?.recipes || [];
  if (forkifyList.length) return forkifyList.slice(0, 4).map(normalizeForkifyCard);

  const mealRes  = await fetch(`${MEALDB_URL}/search.php?s=${encodeURIComponent(query)}`);
  const mealData = await mealRes.json();
  const mealList = mealData?.meals || [];
  if (mealList.length) return mealList.slice(0, 4).map(normalizeMealDBCard);
  return [];
};

const renderReelCard = (reel) => {
  const el = document.createElement("div");
  el.className = "reel-card";
  el.id = `reel-${reel.id}`;

  const embedHTML = reel.type === "youtube"
    ? `<iframe src="https://www.youtube.com/embed/${reel.videoId}?autoplay=0"
          frameborder="0" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
       </iframe>`
    : `<iframe src="https://www.instagram.com/p/${reel.videoId}/embed/"
          frameborder="0" scrolling="no" allowtransparency="true">
       </iframe>`;

  el.innerHTML = `
    <div class="reel-video-wrap">${embedHTML}</div>
    <div class="reel-body">
      <div class="reel-title-row">
        <span class="reel-platform-badge reel-badge-${reel.type}">
          <i class="fab fa-${reel.type === "youtube" ? "youtube" : "instagram"}"></i>
          ${reel.type === "youtube" ? "YouTube Shorts" : "Instagram Reel"}
        </span>
        <button class="reel-delete-btn" onclick="deleteReel('${reel.id}')" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      ${reel.title ? `<p class="reel-video-title">${reel.title}</p>` : ""}
      <p class="reel-search-label">
        <i class="fas fa-search"></i> Recipes found for "<strong>${reel.searchQuery}</strong>"
      </p>
      <div class="reel-recipes" id="reel-recipes-${reel.id}">
        <div class="reel-loading"><i class="fas fa-spinner fa-spin"></i> Finding recipes…</div>
      </div>
    </div>
  `;
  return el;
};

const populateReelRecipes = async (reel) => {
  const container = document.getElementById(`reel-recipes-${reel.id}`);
  if (!container) return;
  const recipes = await searchReelRecipes(reel.searchQuery);
  if (!recipes.length) {
    container.innerHTML = `<p class="reel-no-recipes"><i class="fas fa-circle-exclamation"></i> No recipes found.</p>`;
    return;
  }
  container.innerHTML = recipes.map((r) => `
    <div class="reel-recipe-chip" onclick="getRecipeById('${r.id}')">
      <img src="${r.image}" alt="${r.title}"
           onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'" />
      <span>${r.title}</span>
    </div>
  `).join("");
};

const toggleReelsPanel = () => {
  const panel   = document.getElementById("reels-panel");
  const overlay = document.getElementById("reels-overlay");
  const isOpen  = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  overlay.classList.toggle("open", !isOpen);
};

const addReel = async () => {
  const input = document.getElementById("reels-input");
  const errEl = document.getElementById("reels-error");
  const url   = input.value.trim();
  errEl.style.display = "none";

  const ytId = parseYouTubeShortsId(url);
  const igId = parseInstagramReelId(url);

  if (!ytId && !igId) {
    errEl.textContent = "Please paste a valid YouTube Shorts or Instagram Reels link.";
    errEl.style.display = "block";
    return;
  }

  const type    = ytId ? "youtube" : "instagram";
  const videoId = ytId || igId;
  const reelId  = `${type}-${videoId}`;

  const existing = await dbLoadReels();
  if (existing.find((r) => r.id === reelId)) {
    errEl.textContent = "This reel is already added.";
    errEl.style.display = "block";
    return;
  }

  input.value = "";

  const reel = { id: reelId, type, videoId, title: "", searchQuery: "…" };
  const card = renderReelCard(reel);
  document.getElementById("reels-list").prepend(card);
  document.getElementById(`reel-recipes-${reelId}`).innerHTML =
    `<div class="reel-loading"><i class="fas fa-spinner fa-spin"></i> Fetching title…</div>`;

  let title = "", searchQuery = "";
  if (type === "youtube") {
    title       = await fetchYouTubeTitle(videoId) || "";
    searchQuery = title ? extractDishFromTitle(title) : "food";
  } else {
    searchQuery = "food";
  }

  reel.title       = title;
  reel.searchQuery = searchQuery;

  const titleEl = card.querySelector(".reel-video-title");
  const labelEl = card.querySelector(".reel-search-label strong");
  if (title && !titleEl) {
    card.querySelector(".reel-search-label").insertAdjacentHTML("beforebegin",
      `<p class="reel-video-title">${title}</p>`);
  } else if (titleEl) {
    titleEl.textContent = title;
  }
  if (labelEl) labelEl.textContent = searchQuery;

  await dbSaveReel(reel);
  await populateReelRecipes(reel);
};

const deleteReel = async (reelId) => {
  await dbDeleteReel(reelId);
  const el = document.getElementById(`reel-${reelId}`);
  if (el) el.remove();
};

const initReels = async () => {
  const reels = await dbLoadReels();
  const list  = document.getElementById("reels-list");
  for (const reel of reels) {
    const card = renderReelCard(reel);
    list.appendChild(card);
    populateReelRecipes(reel);
  }
};

initReels();

// ─── Voice Search ─────────────────────────────────────────────────────────────
const startVoiceSearch = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Your browser doesn't support voice search. Try Chrome or Edge.");
    return;
  }
  const mic   = document.getElementById("mic-btn");
  const input = document.getElementById("search-input");
  const recognition = new SpeechRecognition();
  recognition.lang  = "en-US";
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;

  mic.classList.add("listening");
  input.placeholder = "Listening…";
  recognition.start();

  recognition.onresult = (e) => {
    const spoken = e.results[0][0].transcript;
    input.value  = spoken;
    mic.classList.remove("listening");
    input.placeholder = "Search any dish worldwide…";
    getAllRecipes(spoken);
  };
  recognition.onerror = recognition.onend = () => {
    mic.classList.remove("listening");
    input.placeholder = "Search any dish worldwide…";
  };
};

// ─── Surprise Me ─────────────────────────────────────────────────────────────
const surpriseMe = async () => {
  openModal();
  clearModal();
  try {
    const res  = await fetch(`${MEALDB_URL}/random.php`);
    const data = await res.json();
    const m    = data?.meals?.[0];
    if (!m) return;
    currentRecipeId = `mealdb::${m.idMeal}`;
    await loadMealDBDetail(m.idMeal);
    await syncModalFavBtn();
  } catch (err) {
    console.error("Surprise me error:", err);
    closeModal();
  }
};
