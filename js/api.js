var API_KEY = "4f9abeab";
var BASE_URL = "https://www.omdbapi.com/";

export async function searchMovies(query, page) {
  if (!query) {
    return { Search: [], totalResults: 0 };
  }

  var url = BASE_URL + "?apikey=" + API_KEY + "&s=" + encodeURIComponent(query) + "&page=" + page;

  var response = await fetch(url);
  
  if (!response.ok) {
    throw new Error("Network error while searching.");
  }

  var data = await response.json();
  
  if (data.Response === "False") {
    throw new Error(data.Error || "No results found.");
  }

  return data;
}

export async function getMovieById(imdbID) {
  var url = BASE_URL + "?apikey=" + API_KEY + "&i=" + imdbID + "&plot=full";

  var response = await fetch(url);
  
  if (!response.ok) {
    throw new Error("Network error while loading details.");
  }

  var data = await response.json();
  
  if (data.Response === "False") {
    throw new Error(data.Error || "Could not load details.");
  }

  return data;
}
