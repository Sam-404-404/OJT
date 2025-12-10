import { searchMovies, getMovieById } from "./api.js";
import { saveFavorite, removeFavorite, getAllFavorites } from "./db.js";

const YT_API_KEY = "AIzaSyAXW5IsX6WIykP6XX9Kp6sv5lHCwIUgPZs";

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

let baseQuery = "aa";
let currentPage = 1;
let totalPages = 1;
let allResults = [];
let favorites = new Map();
let selectedGenre = "";
let selectedSort = "relevance";
let currentMovie = null;
let isHomepage = true;

function setStatus(msg, isError) {
  statusText.textContent = msg;
  if (isError) {
    statusText.style.color = "#ff8080";
  } else {
    statusText.style.color = "#bbbbc8";
  }
}

function updatePageButtons() {
  pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function filterAndSortMovies(movies) {
  let filtered = movies || [];

  filtered = filtered.filter(function(m) {
    return m.Poster && m.Poster !== "N/A";
  });

  filtered = filtered.filter(function(m) {
    return m.Type === "movie" || m.Type === "series" || !m.Type;
  });

  if (selectedGenre) {
    filtered = filtered.filter(function(m) {
      let text = (m.Genre || m.Title || "").toLowerCase();
      return text.includes(selectedGenre.toLowerCase());
    });
  }

  if (selectedSort === "year-desc") {
    filtered.sort(function(a, b) {
      return (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0);
    });
  } else if (selectedSort === "year-asc") {
    filtered.sort(function(a, b) {
      return (parseInt(a.Year) || 0) - (parseInt(b.Year) || 0);
    });
  } else if (selectedSort === "title-asc") {
    filtered.sort(function(a, b) {
      return (a.Title || "").localeCompare(b.Title || "");
    });
  }

  return filtered;
}


async function getTrailerId(title, imdbID) {
  let cacheKey = imdbID ? "yt_trailer_" + imdbID : "yt_trailer_" + title;
  
  try {
    let cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  if (!YT_API_KEY || YT_API_KEY === "REPLACE_WITH_YOUR_KEY") {
    return null;
  }

  let searchQuery = encodeURIComponent(title + " official trailer");
  let url = "https://www.googleapis.com/youtube/v3/search?part=snippet&q=" + searchQuery + "&type=video&maxResults=1&key=" + YT_API_KEY;

  try {
    let res = await fetch(url);
    if (!res.ok) {
      return null;
    }
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
  if (movie.Poster && movie.Poster !== "N/A") {
    img.src = movie.Poster;
  } else {
    img.src = "https://via.placeholder.com/300x450?text=No+Image";
  }
  img.alt = movie.Title || "Poster";
  posterBox.appendChild(img);

  let trailerBox = document.createElement("div");
  trailerBox.className = "trailer-preview";
  posterBox.appendChild(trailerBox);

  let heartBtn = document.createElement("button");
  heartBtn.className = "card-heart";
  let isFav = favorites.has(movie.imdbID);
  if (isFav) {
    heartBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    heartBtn.classList.add("active");
  } else {
    heartBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
  }

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

  card.addEventListener("click", function() {
    openMovieDetails(movie.imdbID);
  });

  let hoverTimer = null;
  let trailerLoaded = false;

  posterBox.addEventListener("mouseenter", function() {
    if (trailerLoaded) return;

    hoverTimer = setTimeout(async function() {
      let videoId = await getTrailerId(movie.Title, movie.imdbID);
      if (!videoId) return;

      let iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + videoId + "?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1";
      iframe.setAttribute("frameborder", "0");
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.display = "block";

      trailerBox.appendChild(iframe);
      trailerLoaded = true;
    }, 200);
  });

  posterBox.addEventListener("mouseleave", function() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (trailerLoaded) {
      trailerBox.innerHTML = "";
      trailerLoaded = false;
    }
  });

  return card;
}

function showResults() {
  resultsRow.innerHTML = "";

  let filtered = filterAndSortMovies(allResults);

  let pageMovies;
  if (isHomepage) {
    let perPage = 10;
    let start = (currentPage - 1) * perPage;
    let end = start + perPage;
    pageMovies = filtered.slice(start, end);
  } else {
    pageMovies = filtered;
  }

  for (let i = 0; i < pageMovies.length; i++) {
    let card = createMovieCard(pageMovies[i]);
    resultsRow.appendChild(card);
  }

  updatePageButtons();
}


async function toggleFavorite(movie) {
  let isFav = favorites.has(movie.imdbID);

  if (isFav) {
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
    if (m.Poster && m.Poster !== "N/A") {
      img.src = m.Poster;
    } else {
      img.src = "https://via.placeholder.com/60x90?text=No+Image";
    }

    let info = document.createElement("div");
    info.className = "fav-info";

    let h4 = document.createElement("h4");
    h4.textContent = m.Title;

    let p = document.createElement("p");
    p.textContent = m.Year + " • " + m.Type;

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

    info.appendChild(h4);
    info.appendChild(p);
    info.appendChild(removeBtn);

    item.appendChild(img);
    item.appendChild(info);

    item.addEventListener("click", function() {
      openMovieDetails(m.imdbID);
    });

    favList.appendChild(item);
  }
}

async function openMovieDetails(imdbID) {
  try {
    setStatus("Loading details...");
    let data = await getMovieById(imdbID);
    currentMovie = data;

    if (data.Poster && data.Poster !== "N/A") {
      modalPoster.src = data.Poster;
    } else {
      modalPoster.src = "";
    }

    modalTitle.textContent = data.Title || "Title";
    modalTopMeta.innerHTML = (data.Year || "") + " • " + (data.Runtime || "") + " • ⭐ " + (data.imdbRating || "N/A") + " • " + (data.Rated || "");
    modalPlot.textContent = data.Plot || "No plot available.";
    modalGenre.textContent = data.Genre || "N/A";
    modalDirector.textContent = data.Director || "N/A";
    modalCast.textContent = data.Actors || "N/A";
    modalBoxOffice.textContent = data.BoxOffice || "N/A";
    imdbLink.href = "https://www.imdb.com/title/" + data.imdbID + "/";

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

modalOverlay.addEventListener("click", function(e) {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

modalFavBtn.addEventListener("click", async function() {
  if (currentMovie) {
    await toggleFavorite(currentMovie);
  }
});

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
  if (q) {
    baseQuery = q;
  } else {
    baseQuery = "aa";
  }
  currentPage = 1;
  loadPage(currentPage);
}

searchInput.addEventListener("input", function() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(handleSearch, 600);
});

searchBtn.addEventListener("click", handleSearch);

for (let i = 0; i < genreChips.length; i++) {
  genreChips[i].addEventListener("click", function() {
    for (let j = 0; j < genreChips.length; j++) {
      genreChips[j].classList.remove("active");
    }
    this.classList.add("active");

    let label = this.textContent.trim();
    if (label === "All") {
      selectedGenre = "";
    } else {
      selectedGenre = label;
    }
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
    setStatus("Loading movies…");
    isHomepage = false;

    let data = await searchMovies(baseQuery, page);
    let total = parseInt(data.totalResults || "0");
    totalPages = Math.max(1, Math.ceil(total / 10));

    if (data.Search && Array.isArray(data.Search)) {
      allResults = data.Search;
    } else {
      allResults = [];
    }

    updatePageButtons();
    showResults();
    setStatus("Found about " + total + " results.");

  } catch (err) {
    setStatus(err.message, true);
  }
}

async function loadHomepageMovies() {
  try {
    setStatus("Loading homepage movies…");

    let movieIds = [
      "tt4154796", "tt7286456", "tt1375666", "tt0468569",
      "tt10872600", "tt1877830", "tt0816692", "tt1160419",
      "tt0120338", "tt0133093", "tt0120737", "tt0167261",
      "tt0088763", "tt4633694", "tt1345836", "tt4154756",
      "tt0080684", "tt0109830", "tt0944947", "tt0903747"
    ];

    let promises = [];
    for (let i = 0; i < movieIds.length; i++) {
      promises.push(getMovieById(movieIds[i]));
    }
    let movies = await Promise.all(promises);

    isHomepage = true;
    allResults = movies;
    totalPages = Math.max(1, Math.ceil(allResults.length / 10));
    currentPage = 1;

    showResults();
    updatePageButtons();
    setStatus("");

  } catch (err) {
    console.error("Error loading homepage:", err);
    setStatus("Error: " + err.message, true);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  let intro = document.getElementById("introScreen");
  let startBtn = document.getElementById("startBtn");

  startBtn.addEventListener("click", function() {
    intro.classList.add("fade-out");
  });
});

async function init() {
  try {
    let favs = await getAllFavorites();
    for (let i = 0; i < favs.length; i++) {
      favorites.set(favs[i].imdbID, favs[i]);
    }
    updateFavoritesPanel();
  } catch (err) {
    console.error("Error loading favorites:", err);
  }

  await loadHomepageMovies();
}

window.loadPage = loadPage;
window.baseQuery = baseQuery;
window.currentPage = currentPage;
window.loadHomepageMovies = loadHomepageMovies;

init();
