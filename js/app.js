import { searchMovies, getMovieById } from "./api.js";
import { saveFavorite, removeFavorite, getAllFavorites } from "./db.js";

var youtubeApiKey = "AIzaSyBQAVnAtIIE5hkp57p0I4F1AT2zaWX-UuI";

var searchInput = document.getElementById("searchInput");
var searchBtn = document.getElementById("searchBtn");
var sortSelect = document.getElementById("sortSelect");
var genreChips = document.querySelectorAll(".chip-type");
var statusText = document.getElementById("statusText");
var resultsRow = document.getElementById("resultsRow");
var pageInfo = document.getElementById("pageInfo");
var prevBtn = document.getElementById("prevBtn");
var nextBtn = document.getElementById("nextBtn");
var favToggle = document.getElementById("favToggle");
var favPanel = document.getElementById("favPanel");
var favClose = document.getElementById("favClose");
var panelOverlay = document.getElementById("panelOverlay");
var favList = document.getElementById("favoritesRow");
var favCountEl = document.getElementById("favCount");
var modalOverlay = document.getElementById("modalOverlay");
var modalPoster = document.getElementById("modalPoster");
var modalTitle = document.getElementById("modalTitle");
var modalTopMeta = document.getElementById("modalTopMeta");
var modalPlot = document.getElementById("modalPlot");
var modalGenre = document.getElementById("modalGenre");
var modalDirector = document.getElementById("modalDirector");
var modalCast = document.getElementById("modalCast");
var modalBoxOffice = document.getElementById("modalBoxOffice");
var modalFavBtn = document.getElementById("modalFavBtn");
var imdbLink = document.getElementById("imdbLink");
var closeModalBtn = document.getElementById("closeModalBtn");

var searchQuery = "movie";
var currentPageNumber = 1;
var totalPagesCount = 1;
var moviesList = [];
var favoriteMovies = new Map();
var selectedGenreFilter = "";
var selectedSortOption = "relevance";
var currentOpenMovie = null;
var searchTimeout = null;

function showStatusMessage(message, isError) {
  statusText.textContent = message;
  if (isError) {
    statusText.style.color = "#ff8080";
  } else {
    statusText.style.color = "#bbbbc8";
  }
}

function updatePaginationButtons() {
  pageInfo.textContent = "Page " + currentPageNumber + " of " + totalPagesCount;
  if (currentPageNumber <= 1) {
    prevBtn.disabled = true;
  } else {
    prevBtn.disabled = false;
  }
  if (currentPageNumber >= totalPagesCount) {
    nextBtn.disabled = true;
  } else {
    nextBtn.disabled = false;
  }
}


function filterMovies(movies) {
  var result = [];
  
  for (var i = 0; i < movies.length; i++) {
    var movie = movies[i];
    if (movie.Type === "movie" || movie.Type === "series" || !movie.Type) {
      result.push(movie);
    }
  }
  
  if (selectedSortOption === "year-desc") {
    result.sort(function(a, b) {
      var yearA = parseInt(a.Year) || 0;
      var yearB = parseInt(b.Year) || 0;
      return yearB - yearA;
    });
  } else if (selectedSortOption === "year-asc") {
    result.sort(function(a, b) {
      var yearA = parseInt(a.Year) || 0;
      var yearB = parseInt(b.Year) || 0;
      return yearA - yearB;
    });
  } else if (selectedSortOption === "title-asc") {
    result.sort(function(a, b) {
      var titleA = a.Title || "";
      var titleB = b.Title || "";
      return titleA.localeCompare(titleB);
    });
  }
  
  return result;
}

async function fetchTrailerVideoId(movieTitle, movieId) {
  var cacheKey = "trailer_" + (movieId || movieTitle);
  
  try {
    var cachedId = sessionStorage.getItem(cacheKey);
    if (cachedId) {
      return cachedId;
    }
  } catch (error) {}
  
  var searchTerm = movieTitle + " official trailer";
  var apiUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&q=" + encodeURIComponent(searchTerm) + "&type=video&maxResults=1&key=" + youtubeApiKey;
  
  try {
    var response = await fetch(apiUrl);
    if (!response.ok) {
      return null;
    }
    var data = await response.json();
    if (data.items && data.items.length > 0 && data.items[0].id) {
      var videoId = data.items[0].id.videoId;
      try {
        sessionStorage.setItem(cacheKey, videoId);
      } catch (error) {}
      return videoId;
    }
    return null;
  } catch (error) {
    return null;
  }
}


function createMovieCard(movie) {
  var card = document.createElement("article");
  card.className = "card";
  card.dataset.id = movie.imdbID || "";

  var posterContainer = document.createElement("div");
  posterContainer.className = "poster-container";

  var posterImage = document.createElement("img");
  posterImage.className = "poster-img";
  var posterUrl = "https://via.placeholder.com/300x450/1a1a2e/ffffff?text=" + encodeURIComponent(movie.Title || "No Image");
  if (movie.Poster && movie.Poster !== "N/A") {
    posterUrl = movie.Poster;
  }
  posterImage.src = posterUrl;
  posterImage.alt = movie.Title || "Movie Poster";
  posterImage.loading = "lazy";
  posterImage.onerror = function() {
    this.src = "https://via.placeholder.com/300x450/1a1a2e/ffffff?text=" + encodeURIComponent(movie.Title || "No Image");
  };
  posterContainer.appendChild(posterImage);

  var trailerContainer = document.createElement("div");
  trailerContainer.className = "trailer-preview";
  posterContainer.appendChild(trailerContainer);

  var heartButton = document.createElement("button");
  heartButton.className = "card-heart";
  var isFavorite = favoriteMovies.has(movie.imdbID);
  if (isFavorite) {
    heartButton.innerHTML = '<i class="fa-solid fa-heart"></i>';
    heartButton.classList.add("active");
  } else {
    heartButton.innerHTML = '<i class="fa-regular fa-heart"></i>';
  }

  heartButton.addEventListener("click", async function(event) {
    event.stopPropagation();
    await toggleMovieFavorite(movie);
    displayMovies();
  });

  var cardBody = document.createElement("div");
  cardBody.className = "card-body";

  var titleElement = document.createElement("h3");
  titleElement.className = "card-title";
  titleElement.textContent = movie.Title || "Untitled";

  var metaElement = document.createElement("p");
  metaElement.className = "card-meta";
  metaElement.textContent = (movie.Year || "N/A") + " • " + (movie.Type || "movie");

  var ratingElement = document.createElement("p");
  ratingElement.className = "card-rating";
  ratingElement.innerHTML = '<i class="fa-solid fa-star"></i> ' + (movie.imdbRating || "N/A");

  cardBody.appendChild(titleElement);
  cardBody.appendChild(metaElement);
  cardBody.appendChild(ratingElement);

  card.appendChild(posterContainer);
  cardBody.prepend(heartButton);
  card.appendChild(cardBody);

  card.addEventListener("click", function() {
    openMovieModal(movie.imdbID);
  });

  var hoverTimeout = null;
  var trailerIsLoaded = false;
  var mouseIsOver = false;

  posterContainer.addEventListener("mouseenter", function() {
    mouseIsOver = true;
    
    if (trailerIsLoaded) {
      trailerContainer.classList.add("active");
      posterImage.style.opacity = "0";
      return;
    }
    
    hoverTimeout = setTimeout(async function() {
      if (!mouseIsOver) return;
      
      trailerContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff7aa8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i></div>';
      trailerContainer.classList.add("active");
      posterImage.style.opacity = "0";
      
      var videoId = await fetchTrailerVideoId(movie.Title, movie.imdbID);
      
      if (!mouseIsOver) {
        trailerContainer.innerHTML = "";
        trailerContainer.classList.remove("active");
        posterImage.style.opacity = "1";
        return;
      }
      
      if (!videoId) {
        trailerContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;">No trailer</div>';
        setTimeout(function() {
          if (!mouseIsOver) {
            trailerContainer.innerHTML = "";
            trailerContainer.classList.remove("active");
            posterImage.style.opacity = "1";
          }
        }, 1500);
        return;
      }

      var videoFrame = document.createElement("iframe");
      videoFrame.src = "https://www.youtube.com/embed/" + videoId + "?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1";
      videoFrame.setAttribute("frameborder", "0");
      videoFrame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      videoFrame.style.width = "100%";
      videoFrame.style.height = "100%";
      videoFrame.style.position = "absolute";
      videoFrame.style.top = "0";
      videoFrame.style.left = "0";
      videoFrame.style.border = "0";
      
      trailerContainer.innerHTML = "";
      trailerContainer.appendChild(videoFrame);
      trailerIsLoaded = true;
    }, 600);
  });

  posterContainer.addEventListener("mouseleave", function() {
    mouseIsOver = false;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    trailerContainer.classList.remove("active");
    posterImage.style.opacity = "1";
    if (!trailerIsLoaded) {
      trailerContainer.innerHTML = "";
    }
  });

  return card;
}


function displayMovies() {
  resultsRow.innerHTML = "";
  var filteredMovies = filterMovies(moviesList);

  for (var i = 0; i < filteredMovies.length; i++) {
    var card = createMovieCard(filteredMovies[i]);
    resultsRow.appendChild(card);
  }
  updatePaginationButtons();
}

async function toggleMovieFavorite(movie) {
  if (favoriteMovies.has(movie.imdbID)) {
    await removeFavorite(movie.imdbID);
    favoriteMovies.delete(movie.imdbID);
  } else {
    await saveFavorite(movie);
    favoriteMovies.set(movie.imdbID, movie);
  }
  updateFavoritesList();
}

function updateFavoritesList() {
  favList.innerHTML = "";
  var favoritesArray = Array.from(favoriteMovies.values());
  favCountEl.textContent = favoritesArray.length;

  for (var i = 0; i < favoritesArray.length; i++) {
    var movie = favoritesArray[i];
    
    var item = document.createElement("div");
    item.className = "fav-item";

    var image = document.createElement("img");
    if (movie.Poster && movie.Poster !== "N/A") {
      image.src = movie.Poster;
    } else {
      image.src = "https://via.placeholder.com/60x90?text=No+Image";
    }

    var info = document.createElement("div");
    info.className = "fav-info";
    info.innerHTML = "<h4>" + movie.Title + "</h4><p>" + movie.Year + " • " + movie.Type + "</p>";

    var removeButton = document.createElement("button");
    removeButton.className = "fav-remove";
    removeButton.textContent = "Remove";
    
    (function(movieToRemove) {
      removeButton.addEventListener("click", async function(event) {
        event.stopPropagation();
        await removeFavorite(movieToRemove.imdbID);
        favoriteMovies.delete(movieToRemove.imdbID);
        updateFavoritesList();
        displayMovies();
      });
    })(movie);

    info.appendChild(removeButton);
    item.appendChild(image);
    item.appendChild(info);
    
    (function(movieId) {
      item.addEventListener("click", function() {
        openMovieModal(movieId);
      });
    })(movie.imdbID);
    
    favList.appendChild(item);
  }
}

async function openMovieModal(movieId) {
  try {
    var movieData = await getMovieById(movieId);
    currentOpenMovie = movieData;

    if (movieData.Poster && movieData.Poster !== "N/A") {
      modalPoster.src = movieData.Poster;
    } else {
      modalPoster.src = "";
    }
    
    modalTitle.textContent = movieData.Title || "Title";
    modalTopMeta.innerHTML = (movieData.Year || "") + " • " + (movieData.Runtime || "") + " • ⭐ " + (movieData.imdbRating || "N/A") + " • " + (movieData.Rated || "");
    modalPlot.textContent = movieData.Plot || "No plot available.";
    modalGenre.textContent = movieData.Genre || "N/A";
    modalDirector.textContent = movieData.Director || "N/A";
    modalCast.textContent = movieData.Actors || "N/A";
    modalBoxOffice.textContent = movieData.BoxOffice || "N/A";
    imdbLink.href = "https://www.imdb.com/title/" + movieData.imdbID + "/";

    modalOverlay.classList.add("open");
  } catch (error) {
    console.log("Error loading movie details:", error);
  }
}

function closeMovieModal() {
  modalOverlay.classList.remove("open");
}

closeModalBtn.addEventListener("click", closeMovieModal);

modalOverlay.addEventListener("click", function(event) {
  if (event.target === modalOverlay) {
    closeMovieModal();
  }
});

modalFavBtn.addEventListener("click", async function() {
  if (currentOpenMovie) {
    await toggleMovieFavorite(currentOpenMovie);
  }
});

favToggle.addEventListener("click", function() {
  favPanel.classList.add("open");
  panelOverlay.classList.add("open");
});

favClose.addEventListener("click", closeFavoritesPanel);
panelOverlay.addEventListener("click", closeFavoritesPanel);

function closeFavoritesPanel() {
  favPanel.classList.remove("open");
  panelOverlay.classList.remove("open");
}


function performSearch() {
  var userInput = searchInput.value.trim();
  if (userInput !== "") {
    searchQuery = userInput;
  } else {
    searchQuery = "movie";
  }
  currentPageNumber = 1;
  loadMoviesPage(currentPageNumber);
}

searchInput.addEventListener("input", function() {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(performSearch, 500);
});

searchBtn.addEventListener("click", performSearch);

for (var i = 0; i < genreChips.length; i++) {
  genreChips[i].addEventListener("click", function() {
    for (var j = 0; j < genreChips.length; j++) {
      genreChips[j].classList.remove("active");
    }
    this.classList.add("active");
    
    var chipText = this.textContent.trim();
    if (chipText === "All") {
      selectedGenreFilter = "";
      searchQuery = "movie";
    } else if (chipText === "Crime") {
      selectedGenreFilter = "Crime";
      searchQuery = "crime";
    } else if (chipText === "Sci-Fi") {
      selectedGenreFilter = "Sci-Fi";
      searchQuery = "sci-fi";
    } else if (chipText === "Comedy") {
      selectedGenreFilter = "Comedy";
      searchQuery = "comedy";
    } else if (chipText === "Adventure") {
      selectedGenreFilter = "Adventure";
      searchQuery = "adventure";
    } else {
      selectedGenreFilter = chipText;
      searchQuery = chipText;
    }
    currentPageNumber = 1;
    loadMoviesPage(currentPageNumber);
  });
}

sortSelect.addEventListener("change", function(event) {
  selectedSortOption = event.target.value;
  currentPageNumber = 1;
  displayMovies();
});

prevBtn.addEventListener("click", function() {
  if (currentPageNumber > 1) {
    currentPageNumber = currentPageNumber - 1;
    loadMoviesPage(currentPageNumber);
  }
});

nextBtn.addEventListener("click", function() {
  if (currentPageNumber < totalPagesCount) {
    currentPageNumber = currentPageNumber + 1;
    loadMoviesPage(currentPageNumber);
  }
});

async function loadMoviesPage(pageNumber) {
  try {
    showStatusMessage("", false);
    
    var searchData = await searchMovies(searchQuery, pageNumber);
    var totalResults = parseInt(searchData.totalResults) || 0;
    totalPagesCount = Math.max(1, Math.ceil(totalResults / 10));
    
    var searchResults = searchData.Search || [];
    moviesList = searchResults;
    
    updatePaginationButtons();
    displayMovies();
    
    for (var i = 0; i < searchResults.length; i++) {
      (function(index, movieId) {
        getMovieById(movieId).then(function(fullDetails) {
          moviesList[index] = fullDetails;
          var cardElement = resultsRow.querySelector('[data-id="' + movieId + '"]');
          if (cardElement) {
            var ratingElement = cardElement.querySelector('.card-rating');
            if (ratingElement) {
              ratingElement.innerHTML = '<i class="fa-solid fa-star"></i> ' + (fullDetails.imdbRating || "N/A");
            }
          }
        }).catch(function() {});
      })(i, searchResults[i].imdbID);
    }
  } catch (error) {
    showStatusMessage(error.message, true);
  }
}

async function loadInitialMovies() {
  try {
    searchQuery = "movie";
    currentPageNumber = 1;
    await loadMoviesPage(1);
  } catch (error) {
    showStatusMessage(error.message, true);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var introScreen = document.getElementById("introScreen");
  var startButton = document.getElementById("startBtn");
  
  startButton.addEventListener("click", function() {
    introScreen.classList.add("fade-out");
  });
});

async function initializeApp() {
  try {
    var savedFavorites = await getAllFavorites();
    for (var i = 0; i < savedFavorites.length; i++) {
      favoriteMovies.set(savedFavorites[i].imdbID, savedFavorites[i]);
    }
    updateFavoritesList();
  } catch (error) {
    console.log("Error loading favorites:", error);
  }
  
  await loadInitialMovies();
}

window.loadPage = loadMoviesPage;
window.loadHomepageMovies = loadInitialMovies;

initializeApp();
