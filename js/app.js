console.log("THIS IS THE CORRECT APP.JS LOADED");

import { searchMovies, getMovieById } from "./api.js";
import { saveFavorite, removeFavorite, getAllFavorites } from "./db.js";


const YT_API_KEY = "AIzaSyAXW5IsX6WIykP6XX9Kp6sv5lHCwIUgPZs";

// --- ELEMENTS ---
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sortSelect = document.getElementById("sortSelect");
const genreChips = document.querySelectorAll(".chip-type");
const statusText = document.getElementById("statusText");

const resultsRow = document.getElementById("resultsRow");
const pageInfo = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// favorites
const favToggle = document.getElementById("favToggle");
const favPanel = document.getElementById("favPanel");
const favClose = document.getElementById("favClose");
const panelOverlay = document.getElementById("panelOverlay");
const favList = document.getElementById("favoritesRow");
const favCountEl = document.getElementById("favCount");

// modal
const modalOverlay = document.getElementById("modalOverlay");
const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalTopMeta = document.getElementById("modalTopMeta");
const modalPlot = document.getElementById("modalPlot");
const modalGenre = document.getElementById("modalGenre");
const modalDirector = document.getElementById("modalDirector");
const modalCast = document.getElementById("modalCast");
const modalBoxOffice = document.getElementById("modalBoxOffice");
const modalFavBtn = document.getElementById("modalFavBtn");
const imdbLink = document.getElementById("imdbLink");
const closeModalBtn = document.getElementById("closeModalBtn");

// --- STATE ---
let baseQuery = "aa";
let currentPage = 1;
let totalPages = 1;
let allResults = [];
let favoritesMap = new Map();
let activeGenre = "";
let activeSort = "relevance";
let currentModalMovie = null;

// --- HELPERS ---
function debounce(fn, delay = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function setStatus(msg, error = false) {
  statusText.textContent = msg;
  statusText.style.color = error ? "#ff8080" : "#bbbbc8";
}

function updatePageUI() {
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

// --- FILTERS ---
function applyGenreAndSort(list) {
  let filtered = list || [];

  filtered = filtered.filter(m => m.Poster && m.Poster !== "N/A");
  filtered = filtered.filter(m => m.Type === "movie" || m.Type === "series" || !m.Type);

  if (activeGenre) {
    filtered = filtered.filter(m =>
      (m.Genre || m.Title || "").toLowerCase().includes(activeGenre.toLowerCase())
    );
  }

  if (activeSort === "year-desc") {
    filtered = [...filtered].sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0));
  } else if (activeSort === "year-asc") {
    filtered = [...filtered].sort((a, b) => (parseInt(a.Year) || 0) - (parseInt(b.Year) || 0));
  } else if (activeSort === "title-asc") {
    filtered = [...filtered].sort((a, b) => (a.Title || "").localeCompare(b.Title || ""));
  }

  return filtered;
}

/* ---------------------------
   YouTube Trailer Utilities
   --------------------------- */

/**
 * Fetch the first youtube video id for "<title> official trailer"
 * Uses YouTube Data API v3. Requires YT_API_KEY to be set.
 * Caches results in sessionStorage keyed by imdbID (if present) or title.
 */
async function fetchYoutubeTrailerId({ title, imdbID }) {
  // use imdbID as cache key if available
  const cacheKey = imdbID ? `yt_trailer_${imdbID}` : `yt_trailer_${title}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (e) {
    // sessionStorage may throw in some environments, ignore
  }

  if (!YT_API_KEY || YT_API_KEY === "REPLACE_WITH_YOUR_KEY") {
    // No key configured — bail out gracefully.
    return null;
  }

  const q = encodeURIComponent(`${title} official trailer`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${YT_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("YouTube API error:", res.status);
      return null;
    }
    const json = await res.json();
    const id = json?.items?.[0]?.id?.videoId ?? null;
    if (id) {
      try { sessionStorage.setItem(cacheKey, id); } catch (e) {}
      return id;
    }
    return null;
  } catch (err) {
    console.error("fetchYoutubeTrailerId error", err);
    return null;
  }
}

/* ---------------------------
   Card creation (with trailer)
   --------------------------- */

/**
 * Escapes text to avoid injecting HTML
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createCard(movie) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = movie.imdbID || "";

  // create poster container (so we can overlay iframe there)
  const posterContainer = document.createElement("div");
  posterContainer.className = "poster-container";

  const img = document.createElement("img");
  img.className = "poster-img";
  img.src = movie.Poster && movie.Poster !== "N/A"
    ? movie.Poster
    : "https://via.placeholder.com/300x450?text=No+Image";
  img.alt = movie.Title || "Poster";

  posterContainer.appendChild(img);

  // trailer preview container (empty until hover)
  const trailerDiv = document.createElement("div");
  trailerDiv.className = "trailer-preview";
  posterContainer.appendChild(trailerDiv);

  // heart button
  const heart = document.createElement("button");
  heart.className = "card-heart";
  const isFav = favoritesMap.has(movie.imdbID);
  heart.innerHTML = `<i class="${isFav ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
  if (isFav) heart.classList.add("active");

  heart.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleFavorite(movie);
    renderResults();
  });

  // body
  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = movie.Title || "Untitled";

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = `${movie.Year || "N/A"} • ${movie.Type || "movie"}`;

  const rating = document.createElement("p");
  rating.className = "card-rating";
  rating.innerHTML = `<i class="fa-solid fa-star"></i> ${movie.imdbRating || "N/A"}`;

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(rating);

  // assemble card (poster first, heart overlays on card via CSS)
  card.appendChild(posterContainer);
  body.prepend(heart);
  card.appendChild(body);

  // click opens modal
  card.addEventListener("click", () => openDetails(movie.imdbID));

  /* -----------------------------
     Hover logic: load & play trailer
     ----------------------------- */
  let hoverTimer = null;
  let trailerLoaded = false;

  posterContainer.addEventListener("mouseenter", () => {
    // if already loaded, do nothing
    if (trailerLoaded) return;

    // start a small debounce (avoid accidental hover fetches)
    hoverTimer = setTimeout(async () => {
      const id = await fetchYoutubeTrailerId({
        title: movie.Title,
        imdbID: movie.imdbID
      });

      if (!id) {
        // no trailer found — we could optionally show a play button or keep poster visible.
        return;
      }

      // create iframe
      const iframe = document.createElement("iframe");
      iframe.setAttribute("src", `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`);
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.display = "block";

      // append iframe (poster opacity will be handled by CSS)
      trailerDiv.appendChild(iframe);
      trailerLoaded = true;
    }, 200);
  });

  posterContainer.addEventListener("mouseleave", () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }

    if (trailerLoaded) {
      trailerDiv.innerHTML = "";
      trailerLoaded = false;
    }
  });

  return card;
}

/* --- RENDER RESULTS --- */
function renderResults() {
  resultsRow.innerHTML = "";

  let filtered = applyGenreAndSort(allResults || []);

  // paginate correctly using currentPage
  const perPage = 10;
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageItems = filtered.slice(start, end);

  pageItems.forEach(m => resultsRow.appendChild(createCard(m)));

  updatePageUI();
}

/* --- FAVORITES --- */
async function toggleFavorite(movie) {
  const isFav = favoritesMap.has(movie.imdbID);

  if (isFav) {
    await removeFavorite(movie.imdbID);
    favoritesMap.delete(movie.imdbID);
  } else {
    await saveFavorite(movie);
    favoritesMap.set(movie.imdbID, movie);
  }

  refreshFavoritesUI();
}

async function refreshFavoritesUI() {
  favList.innerHTML = "";
  let favs = Array.from(favoritesMap.values());

  favCountEl.textContent = favs.length.toString();

  favs.forEach(m => {
    const item = document.createElement("div");
    item.className = "fav-item";

    const img = document.createElement("img");
    img.src = m.Poster && m.Poster !== "N/A" ? m.Poster : "https://via.placeholder.com/60x90?text=No+Image";
    const info = document.createElement("div");
    info.className = "fav-info";

    const h4 = document.createElement("h4");
    h4.textContent = m.Title;

    const p = document.createElement("p");
    p.textContent = `${m.Year} • ${m.Type}`;

    const btn = document.createElement("button");
    btn.className = "fav-remove";
    btn.textContent = "Remove";

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await removeFavorite(m.imdbID);
      favoritesMap.delete(m.imdbID);
      refreshFavoritesUI();
      renderResults();
    });

    info.appendChild(h4);
    info.appendChild(p);
    info.appendChild(btn);

    item.appendChild(img);
    item.appendChild(info);

    item.addEventListener("click", () => openDetails(m.imdbID));

    favList.appendChild(item);
  });
}

/* --- MODAL --- */
async function openDetails(imdbID) {
  try {
    setStatus("Loading details...");
    const data = await getMovieById(imdbID);
    currentModalMovie = data;

    modalPoster.src = data.Poster && data.Poster !== "N/A" ? data.Poster : '';
    modalTitle.textContent = data.Title || "Title";

    modalTopMeta.innerHTML =
      `${data.Year || ""} • ${data.Runtime || ""} • ⭐ ${data.imdbRating || "N/A"} • ${data.Rated || ""}`;

    modalPlot.textContent = data.Plot || "No plot available.";
    modalGenre.textContent = data.Genre || "N/A";
    modalDirector.textContent = data.Director || "N/A";
    modalCast.textContent = data.Actors || "N/A";
    modalBoxOffice.textContent = data.BoxOffice || "N/A";

    imdbLink.href = `https://www.imdb.com/title/${data.imdbID}/`;

    modalOverlay.classList.add("open");
    modalOverlay.setAttribute("aria-hidden", "false");
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  }
}

function closeModal() {
  modalOverlay.classList.remove("open");
  modalOverlay.setAttribute("aria-hidden", "true");
}

closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalFavBtn.addEventListener("click", async () => {
  if (!currentModalMovie) return;
  await toggleFavorite(currentModalMovie);
});

/* --- FAVORITES PANEL --- */
favToggle.addEventListener("click", () => {
  favPanel.classList.add("open");
  panelOverlay.classList.add("open");
});

favClose.addEventListener("click", closeFavPanel);
panelOverlay.addEventListener("click", closeFavPanel);

function closeFavPanel() {
  favPanel.classList.remove("open");
  panelOverlay.classList.remove("open");
}

/* --- SEARCH --- */
const debouncedSearch = debounce(handleSearch, 600);

async function handleSearch() {
  const q = searchInput.value.trim();
  baseQuery = q || "aa";
  currentPage = 1;
  await loadPage(currentPage);
}

searchInput.addEventListener("input", debouncedSearch);
searchBtn.addEventListener("click", handleSearch);

/* --- GENRE FILTER --- */
genreChips.forEach(chip => {
  chip.addEventListener("click", () => {
    genreChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");

    let label = chip.textContent.trim();
    activeGenre = label === "All" ? "" : label;
    // keep page at 1 when filter changed
    currentPage = 1;
    renderResults();
  });
});

/* --- SORT --- */
sortSelect.addEventListener("change", e => {
  activeSort = e.target.value;
  // keep page at 1 when sort changed
  currentPage = 1;
  renderResults();
});

/* --- PAGINATION --- */
prevBtn.addEventListener("click", () => {
  if (currentPage > 1) loadPage(--currentPage);
});

nextBtn.addEventListener("click", () => {
  if (currentPage < totalPages) loadPage(++currentPage);
});

/* --- MAIN LOADER --- */
async function loadPage(page) {
  try {
    setStatus("Loading movies…");

    const data = await searchMovies(baseQuery, page);

    const totalResults = parseInt(data.totalResults || "0", 10);
    totalPages = Math.max(1, Math.ceil(totalResults / 10));

    // Do NOT fetch full details for each movie.
    // Use only the basic search results on homepage.
    allResults = data.Search || [];

    // if API returned something weird, ensure array
    if (!Array.isArray(allResults)) allResults = [];

    updatePageUI();
    renderResults();
    setStatus(`Found about ${totalResults} results.`);

  } catch (err) {
    setStatus(err.message, true);
  }
}

async function loadHomepageMovies() {
  try {
    setStatus("Loading homepage movies…");

    const homepageIDs = [
      "tt4154796","tt7286456","tt1375666","tt0468569",
      "tt10872600","tt1877830","tt0816692","tt1160419",
      "tt0120338","tt0133093","tt0120737","tt0167261",
      "tt0088763","tt4633694","tt1345836","tt4154756",
      "tt0080684","tt0109830","tt0944947","tt0903747"
    ];

    const detailed = await Promise.all(
      homepageIDs.map(id => getMovieById(id))
    );

    allResults = detailed;

    // when homepage uses detailed objects, we have to set total pages for UI
    totalPages = Math.max(1, Math.ceil(allResults.length / 10));
    currentPage = 1;

    renderResults();
    updatePageUI();
    setStatus("");

  } catch (err) {
    console.error(err);
    setStatus(err.message, true);
  }
}

/* INTRO ANIMATION EXIT */
document.addEventListener("DOMContentLoaded", () => {
  const intro = document.getElementById("introScreen");
  const startBtn = document.getElementById("startBtn");

  startBtn.addEventListener("click", () => {
    intro.classList.add("fade-out");
  });
});

/* --- INIT --- */
async function init() {
  const favs = await getAllFavorites();
  favoritesMap = new Map(favs.map(m => [m.imdbID, m]));

  refreshFavoritesUI();
  await loadHomepageMovies();
}

/* --- EXPOSE TO WINDOW FOR BACK BUTTON --- */
window.loadPage = loadPage;
window.baseQuery = baseQuery;
window.currentPage = currentPage;
window.loadHomepageMovies = loadHomepageMovies;

init();

