// js/api.js
const API_KEY = "4f9abeab";
const BASE_URL = "https://www.omdbapi.com/";

/**
 * Search movies with full response (Search + totalResults)
 */
export async function searchMovies(query, page = 1) {
  if (!query) return { Search: [], totalResults: 0 };

  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", API_KEY);
  url.searchParams.set("s", query.trim());
  url.searchParams.set("page", String(page));

  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error while searching.");

  const data = await res.json();
  if (data.Response === "False") {
    throw new Error(data.Error || "No results found.");
  }
  // data.Search (array), data.totalResults (string)
  return data;
}

/**
 * Get full details for one movie by imdbID.
 */
export async function getMovieById(imdbID) {
  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", API_KEY);
  url.searchParams.set("i", imdbID);
  url.searchParams.set("plot", "full");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error while loading details.");

  const data = await res.json();
  if (data.Response === "False") {
    throw new Error(data.Error || "Could not load details.");
  }
  return data;
}