const DB_NAME = "CineScopeDB";
const DB_VERSION = 1;
const STORE_NAME = "favorites";

function openDatabase() {
  return new Promise(function(resolve, reject) {
    let request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function() {
      let db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "imdbID" });
      }
    };

    request.onsuccess = function() {
      resolve(request.result);
    };

    request.onerror = function() {
      reject(request.error);
    };
  });
}

export async function saveFavorite(movie) {
  let db = await openDatabase();
  return new Promise(function(resolve, reject) {
    let tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(movie);
    tx.oncomplete = function() {
      resolve(true);
    };
    tx.onerror = function() {
      reject(tx.error);
    };
  });
}

export async function removeFavorite(imdbID) {
  let db = await openDatabase();
  return new Promise(function(resolve, reject) {
    let tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(imdbID);
    tx.oncomplete = function() {
      resolve(true);
    };
    tx.onerror = function() {
      reject(tx.error);
    };
  });
}

export async function getAllFavorites() {
  let db = await openDatabase();
  return new Promise(function(resolve, reject) {
    let tx = db.transaction(STORE_NAME, "readonly");
    let request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = function() {
      resolve(request.result || []);
    };
    request.onerror = function() {
      reject(request.error);
    };
  });
}
