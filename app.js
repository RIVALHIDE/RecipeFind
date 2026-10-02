
const FORKIFY_URL = "https://forkify-api.jonas.io/api/v2/recipes";
const MEALDB_URL  = "https://www.themealdb.com/api/json/v1/1";




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


const renderCards = (recipes) => {
  return recipes.map((r) => `
    <div class="recipe-card" onclick="getRecipeById('${r.id}')">
      <img src="${r.image}" alt="${r.title}"
           onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'" />
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



const DEFAULT_QUERY = "pizza";

const setBackBtn = (visible) => {
  document.getElementById("back-btn").style.display = visible ? "flex" : "none";
};

const getAllRecipes = async (query = DEFAULT_QUERY) => {
  const grid       = document.getElementById("recipes-grid");
  const countLabel = document.getElementById("count-label");

  grid.innerHTML  = `<div class="msg"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
  countLabel.textContent = "";

  // Show back button only when user has searched something custom
  setBackBtn(query !== DEFAULT_QUERY);

  try {
   
    const forkifyRes  = await fetch(`${FORKIFY_URL}?search=${encodeURIComponent(query)}`);
    const forkifyData = await forkifyRes.json();
    const forkifyList = forkifyData?.data?.recipes || [];

    if (forkifyList.length > 0) {
      const cards = forkifyList.map(normalizeForkifyCard);
      countLabel.textContent = `(${cards.length} results)`;
      grid.innerHTML = renderCards(cards);
      return;
    }

   
    const mealRes  = await fetch(`${MEALDB_URL}/search.php?s=${encodeURIComponent(query)}`);
    const mealData = await mealRes.json();
    const mealList = mealData?.meals || [];

    if (mealList.length > 0) {
      const cards = mealList.map(normalizeMealDBCard);
      countLabel.textContent = `(${cards.length} results via TheMealDB)`;
      grid.innerHTML = renderCards(cards);
      return;
    }

    
    grid.innerHTML = `<div class="msg"><i class="fas fa-circle-exclamation"></i> No recipes found for "<strong>${query}</strong>". Try a different name.</div>`;

  } catch (error) {
    console.error("Search error:", error);
    grid.innerHTML = `<div class="msg"><i class="fas fa-circle-exclamation"></i> Something went wrong. Please try again.</div>`;
  }
};

getAllRecipes("pizza");

// ─── RECIPE DETAIL ──────────────────────────────────────────────────────────

const getRecipeById = async (compositeId) => {
  openModal();
  clearModal();

  const [source, id] = compositeId.split("::");

  try {
    if (source === "forkify") {
      await loadForkifyDetail(id);
    } else {
      await loadMealDBDetail(id);
    }
  } catch (error) {
    console.error("Detail error:", error);
  }
};

// Forkify detail loader
const loadForkifyDetail = async (id) => {
  const res    = await fetch(`${FORKIFY_URL}/${id}`);
  const data   = await res.json();
  const recipe = data?.data?.recipe;

  document.getElementById("modal-img").src              = recipe?.image_url;
  document.getElementById("modal-title").textContent    = recipe?.title;
  document.getElementById("modal-source").href          = recipe?.source_url || "#";

  document.getElementById("modal-info").innerHTML = `
    <div class="info-pill"><i class="fas fa-clock"></i> ${recipe?.cooking_time} min</div>
    <div class="info-pill"><i class="fas fa-user"></i> ${recipe?.servings} servings</div>
    <div class="info-pill"><i class="fas fa-store"></i> ${recipe?.publisher}</div>
  `;

  const ingredientsHTML = recipe?.ingredients.map((ing) => `
    <li>
      <i class="fas fa-check-circle"></i>
      ${ing?.quantity ? +ing.quantity.toFixed(2) : ""} ${ing?.unit} ${ing?.description}
    </li>
  `);
  document.getElementById("modal-ingredients").innerHTML = ingredientsHTML.join("");
};

// TheMealDB detail loader — extracts up to 20 ingredient/measure pairs
const loadMealDBDetail = async (id) => {
  const res  = await fetch(`${MEALDB_URL}/lookup.php?i=${id}`);
  const data = await res.json();
  const m    = data?.meals?.[0];
  if (!m) return;

  document.getElementById("modal-img").src              = m.strMealThumb;
  document.getElementById("modal-title").textContent    = m.strMeal;
  document.getElementById("modal-source").href          = m.strSource || "#";

  document.getElementById("modal-info").innerHTML = `
    ${m.strCategory ? `<div class="info-pill"><i class="fas fa-tag"></i> ${m.strCategory}</div>` : ""}
    ${m.strArea     ? `<div class="info-pill"><i class="fas fa-globe"></i> ${m.strArea}</div>`    : ""}
    ${m.strTags     ? `<div class="info-pill"><i class="fas fa-hashtag"></i> ${m.strTags.split(",")[0]}</div>` : ""}
  `;

  // MealDB stores ingredients as strIngredient1…strIngredient20
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name    = m[`strIngredient${i}`];
    const measure = m[`strMeasure${i}`];
    if (name && name.trim()) {
      ingredients.push(`
        <li>
          <i class="fas fa-check-circle"></i>
          ${measure ? measure.trim() : ""} ${name.trim()}
        </li>
      `);
    }
  }
  document.getElementById("modal-ingredients").innerHTML = ingredients.join("");

  // Show instructions if source URL is missing
  if (!m.strSource) {
    const instrEl = document.getElementById("modal-source");
    instrEl.style.display = "none";
  }
};

// ─── SEARCH HANDLER ─────────────────────────────────────────────────────────

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

// ─── MODAL HELPERS ──────────────────────────────────────────────────────────

const openModal = () => {
  document.getElementById("modal").classList.add("open");
  document.getElementById("modal-source").style.display = "";
};

const closeModal = () => document.getElementById("modal").classList.remove("open");

const clearModal = () => {
  document.getElementById("modal-img").src              = "";
  document.getElementById("modal-title").textContent    = "";
  document.getElementById("modal-info").innerHTML       = `<div class="info-pill"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
  document.getElementById("modal-ingredients").innerHTML = "";
  document.getElementById("modal-source").href          = "#";
};

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});
