const API_KEY = "4f9abeab";
const BASE_URL = "https://www.omdbapi.com/";

export async function searchMovies(query, page) {
  if (!query) {
    return { Search: [], totalResults: 0 };
  }

  let url = BASE_URL + "?apikey=" + API_KEY + "&s=" + encodeURIComponent(query.trim()) + "&page=" + page;

  let res = await fetch(url);
  if (!res.ok) {
    throw new Error("Network error while searching.");
  }

  let data = await res.json();
  if (data.Response === "False") {
    throw new Error(data.Error || "No results found.");
  }

  return data;
}

export async function getMovieById(imdbID) {
  let url = BASE_URL + "?apikey=" + API_KEY + "&i=" + imdbID + "&plot=full";

  let res = await fetch(url);
  if (!res.ok) {
    throw new Error("Network error while loading details.");
  }

  let data = await res.json();
  if (data.Response === "False") {
    throw new Error(data.Error || "Could not load details.");
  }

  return data;
}
