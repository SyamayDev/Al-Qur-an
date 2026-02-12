self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
});

self.addEventListener("fetch", (event) => {
  // Default fetch, bisa ditambah offline cache nanti
});
