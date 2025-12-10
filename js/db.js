var DATABASE_NAME = "CineScopeDB";
var DATABASE_VERSION = 1;
var STORE_NAME = "favorites";

function openDatabase() {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = function() {
      var database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "imdbID" });
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
  var database = await openDatabase();
  
  return new Promise(function(resolve, reject) {
    var transaction = database.transaction(STORE_NAME, "readwrite");
    var store = transaction.objectStore(STORE_NAME);
    store.put(movie);
    
    transaction.oncomplete = function() {
      resolve(true);
    };
    
    transaction.onerror = function() {
      reject(transaction.error);
    };
  });
}

export async function removeFavorite(imdbID) {
  var database = await openDatabase();
  
  return new Promise(function(resolve, reject) {
    var transaction = database.transaction(STORE_NAME, "readwrite");
    var store = transaction.objectStore(STORE_NAME);
    store.delete(imdbID);
    
    transaction.oncomplete = function() {
      resolve(true);
    };
    
    transaction.onerror = function() {
      reject(transaction.error);
    };
  });
}

export async function getAllFavorites() {
  var database = await openDatabase();
  
  return new Promise(function(resolve, reject) {
    var transaction = database.transaction(STORE_NAME, "readonly");
    var store = transaction.objectStore(STORE_NAME);
    var request = store.getAll();
    
    request.onsuccess = function() {
      resolve(request.result || []);
    };
    
    request.onerror = function() {
      reject(request.error);
    };
  });
}
