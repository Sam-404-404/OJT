import { searchMovies, getMovieById } from "./api.js";
import { saveFavorite, removeFavorite, getAllFavorites } from "./db.js";

const YT_API_KEY = "AIzaSyBkVxwsREwoHOsJF-tEl8mzIpP4pySaBL4";

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sortSelect = document.getElementById("sortSelect");
const genreChips = document.querySelectorAll(".chip-type");
const statusText = document.getElementById("statusText");
const resultsRow = document.getElementById("resultsRow");
const pageInfo = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const favToggle = document.getElementById("favToggle");
const favPanel = document.getElementById("favPanel");
const favClose = document.getElementById("favClose");
const panelOverlay = document.getElementById("panelOverlay");
const favList = document.getElementById("favoritesRow");
const favCountEl = document.getElementById("favCount");
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

let baseQuery = "movie";
let currentPage = 1;
let totalPages = 1;
let allResults = [];
let favorites = new Map();
let selectedGenre = "";
let selectedSort = "relevance";
let currentMovie = null;

function setStatus(msg, isError) {
  statusText.textContent = msg;
  statusText.style.color = isError ? "#ff8080" : "#bbbbc8";
}

function updatePageButtons() {
  pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function filterAndSortMovies(movies) {
  let filtered = (movies || []).filter(function(m) {
    return m.Poster && m.Poster !== "N/A";
  }).filter(function(m) {
    return m.Type === "movie" || m.Type === "series" || !m.Type;
  });

  if (selectedGenre) {
    filtered = filtered.filter(function(m) {
      return (m.Genre || m.Title || "").toLowerCase().includes(selectedGenre.toLowerCase());
    });
  }

  if (selectedSort === "year-desc") {
    filtered.sort(function(a, b) { return (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0); });
  } else if (selectedSort === "year-asc") {
    filtered.sort(function(a, b) { return (parseInt(a.Year) || 0) - (parseInt(b.Year) || 0); });
  } else if (selectedSort === "title-asc") {
    filtered.sort(function(a, b) { return (a.Title || "").localeCompare(b.Title || ""); });
  }

  return filtered;
}

async function getTrailerId(title, imdbID) {
  let cacheKey = "yt_" + (imdbID || title);
  try {
    let cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  let url = "https://www.googleapis.com/youtube/v3/search?part=snippet&q=" + 
    encodeURIComponent(title + " official trailer") + "&type=video&maxResults=1&key=" + YT_API_KEY;

  try {
    let res = await fetch(url);
    if (!res.ok) return null;
    let data = await res.json();
    if (data.items && data.items[0] && data.items[0].id) {
      let videoId = data.items[0].id.videoId;
      try { sessionStorage.setItem(cacheKey, videoId); } catch (e) {}
      return videoId;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function createMovieCard(movie) {
  let card = document.createElement("article");
  card.className = "card";
  card.dataset.id = movie.imdbID || "";

  let posterBox = document.createElement("div");
  posterBox.className = "poster-container";

  let img = document.createElement("img");
  img.className = "poster-img";
  img.src = (movie.Poster && movie.Poster !== "N/A") ? movie.Poster : "https://via.placeholder.com/300x450?text=No+Image";
  img.alt = movie.Title || "Poster";
  img.loading = "lazy";
  posterBox.appendChild(img);

  let trailerBox = document.createElement("div");
  trailerBox.className = "trailer-preview";
  posterBox.appendChild(trailerBox);

  let heartBtn = document.createElement("button");
  heartBtn.className = "card-heart";
  let isFav = favorites.has(movie.imdbID);
  heartBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
  if (isFav) heartBtn.classList.add("active");

  heartBtn.addEventListener("click", async function(e) {
    e.stopPropagation();
    await toggleFavorite(movie);
    showResults();
  });

  let body = document.createElement("div");
  body.className = "card-body";

  let title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = movie.Title || "Untitled";

  let meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = (movie.Year || "N/A") + " • " + (movie.Type || "movie");

  let rating = document.createElement("p");
  rating.className = "card-rating";
  rating.innerHTML = '<i class="fa-solid fa-star"></i> ' + (movie.imdbRating || "N/A");

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(rating);

  card.appendChild(posterBox);
  body.prepend(heartBtn);
  card.appendChild(body);

  card.addEventListener("click", function() { openMovieDetails(movie.imdbID); });

  let hoverTimer = null;
  let trailerLoaded = false;
  let isHovering = false;

  posterBox.addEventListener("mouseenter", function() {
    isHovering = true;
    if (trailerLoaded) {
      trailerBox.classList.add("active");
      img.style.opacity = "0";
      return;
    }
    
    hoverTimer = setTimeout(async function() {
      if (!isHovering) return;
      
      trailerBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff7aa8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i></div>';
      trailerBox.classList.add("active");
      img.style.opacity = "0";
      
      let videoId = await getTrailerId(movie.Title, movie.imdbID);
      
      if (!isHovering) {
        trailerBox.innerHTML = "";
        trailerBox.classList.remove("active");
        img.style.opacity = "1";
        return;
      }
      
      if (!videoId) {
        trailerBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;">No trailer</div>';
        setTimeout(function() {
          if (!isHovering) {
            trailerBox.innerHTML = "";
            trailerBox.classList.remove("active");
            img.style.opacity = "1";
          }
        }, 1500);
        return;
      }

      let iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + videoId + "?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1";
      iframe.setAttribute("frameborder", "0");
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.style.cssText = "width:100%;height:100%;position:absolute;top:0;left:0;border:0;";
      
      trailerBox.innerHTML = "";
      trailerBox.appendChild(iframe);
      trailerLoaded = true;
    }, 600);
  });

  posterBox.addEventListener("mouseleave", function() {
    isHovering = false;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    trailerBox.classList.remove("active");
    img.style.opacity = "1";
    if (!trailerLoaded) {
      trailerBox.innerHTML = "";
    }
  });

  return card;
}

function showResults() {
  resultsRow.innerHTML = "";
  let filtered = filterAndSortMovies(allResults);

  for (let i = 0; i < filtered.length; i++) {
    resultsRow.appendChild(createMovieCard(filtered[i]));
  }
  updatePageButtons();
}

async function toggleFavorite(movie) {
  if (favorites.has(movie.imdbID)) {
    await removeFavorite(movie.imdbID);
    favorites.delete(movie.imdbID);
  } else {
    await saveFavorite(movie);
    favorites.set(movie.imdbID, movie);
  }
  updateFavoritesPanel();
}

function updateFavoritesPanel() {
  favList.innerHTML = "";
  let favArray = Array.from(favorites.values());
  favCountEl.textContent = favArray.length;

  for (let i = 0; i < favArray.length; i++) {
    let m = favArray[i];
    let item = document.createElement("div");
    item.className = "fav-item";

    let img = document.createElement("img");
    img.src = (m.Poster && m.Poster !== "N/A") ? m.Poster : "https://via.placeholder.com/60x90?text=No+Image";

    let info = document.createElement("div");
    info.className = "fav-info";
    info.innerHTML = "<h4>" + m.Title + "</h4><p>" + m.Year + " • " + m.Type + "</p>";

    let removeBtn = document.createElement("button");
    removeBtn.className = "fav-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async function(e) {
      e.stopPropagation();
      await removeFavorite(m.imdbID);
      favorites.delete(m.imdbID);
      updateFavoritesPanel();
      showResults();
    });

    info.appendChild(removeBtn);
    item.appendChild(img);
    item.appendChild(info);
    item.addEventListener("click", function() { openMovieDetails(m.imdbID); });
    favList.appendChild(item);
  }
}

async function openMovieDetails(imdbID) {
  try {
    let data = await getMovieById(imdbID);
    currentMovie = data;

    modalPoster.src = (data.Poster && data.Poster !== "N/A") ? data.Poster : "";
    modalTitle.textContent = data.Title || "Title";
    modalTopMeta.innerHTML = (data.Year || "") + " • " + (data.Runtime || "") + " • ⭐ " + (data.imdbRating || "N/A") + " • " + (data.Rated || "");
    modalPlot.textContent = data.Plot || "No plot available.";
    modalGenre.textContent = data.Genre || "N/A";
    modalDirector.textContent = data.Director || "N/A";
    modalCast.textContent = data.Actors || "N/A";
    modalBoxOffice.textContent = data.BoxOffice || "N/A";
    imdbLink.href = "https://www.imdb.com/title/" + data.imdbID + "/";

    modalOverlay.classList.add("open");
  } catch (err) {
    console.error(err);
  }
}

function closeModal() {
  modalOverlay.classList.remove("open");
}

closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", function(e) { if (e.target === modalOverlay) closeModal(); });
modalFavBtn.addEventListener("click", async function() { if (currentMovie) await toggleFavorite(currentMovie); });

favToggle.addEventListener("click", function() {
  favPanel.classList.add("open");
  panelOverlay.classList.add("open");
});

favClose.addEventListener("click", closeFavPanel);
panelOverlay.addEventListener("click", closeFavPanel);

function closeFavPanel() {
  favPanel.classList.remove("open");
  panelOverlay.classList.remove("open");
}

let searchTimer = null;

function handleSearch() {
  let q = searchInput.value.trim();
  baseQuery = q || "movie";
  currentPage = 1;
  loadPage(currentPage);
}

searchInput.addEventListener("input", function() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(handleSearch, 500);
});

searchBtn.addEventListener("click", handleSearch);

for (let i = 0; i < genreChips.length; i++) {
  genreChips[i].addEventListener("click", function() {
    for (let j = 0; j < genreChips.length; j++) genreChips[j].classList.remove("active");
    this.classList.add("active");
    selectedGenre = this.textContent.trim() === "All" ? "" : this.textContent.trim();
    currentPage = 1;
    showResults();
  });
}

sortSelect.addEventListener("change", function(e) {
  selectedSort = e.target.value;
  currentPage = 1;
  showResults();
});

prevBtn.addEventListener("click", function() {
  if (currentPage > 1) {
    currentPage--;
    loadPage(currentPage);
  }
});

nextBtn.addEventListener("click", function() {
  if (currentPage < totalPages) {
    currentPage++;
    loadPage(currentPage);
  }
});


async function loadPage(page) {
  try {
    setStatus("");
    
    let data = await searchMovies(baseQuery, page);
    let total = parseInt(data.totalResults || "0");
    totalPages = Math.max(1, Math.ceil(total / 10));
    
    let searchResults = data.Search || [];
    allResults = searchResults;
    updatePageButtons();
    showResults();
    
    // Fetch ratings in background
    searchResults.forEach(function(m, index) {
      getMovieById(m.imdbID).then(function(details) {
        allResults[index] = details;
        let card = resultsRow.querySelector('[data-id="' + m.imdbID + '"]');
        if (card) {
          let ratingEl = card.querySelector('.card-rating');
          if (ratingEl) ratingEl.innerHTML = '<i class="fa-solid fa-star"></i> ' + (details.imdbRating || "N/A");
        }
      }).catch(function() {});
    });
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function loadHomepageMovies() {
  try {
    baseQuery = "movie";
    currentPage = 1;
    await loadPage(1);
  } catch (err) {
    setStatus(err.message, true);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  let intro = document.getElementById("introScreen");
  let startBtn = document.getElementById("startBtn");
  startBtn.addEventListener("click", function() { intro.classList.add("fade-out"); });
});

async function init() {
  try {
    let favs = await getAllFavorites();
    for (let i = 0; i < favs.length; i++) favorites.set(favs[i].imdbID, favs[i]);
    updateFavoritesPanel();
  } catch (err) {}
  await loadHomepageMovies();
}

window.loadPage = loadPage;
window.loadHomepageMovies = loadHomepageMovies;

init();
