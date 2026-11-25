document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const catalog = document.querySelector(".product-catalog-page");
  const select = document.getElementById("categoryFilter");
  const grid = document.getElementById("productsGrid");
  const search = document.getElementById("searchInput");
  const hero = document.querySelector(".page-hero");
  if (!catalog || !select || !grid || !hero) return;

  const section = document.createElement("section");
  section.className = "catalog-discovery";
  section.setAttribute("aria-labelledby", "catalogDiscoveryHeading");
  section.innerHTML = '<div class="catalog-discovery-heading"><div><span class="catalog-discovery-kicker">Explore by category</span><h2 id="catalogDiscoveryHeading">What are you looking for?</h2><p>Choose a product category to see matching items.</p></div><button class="catalog-discovery-reset" type="button">View all products</button></div><div class="catalog-category-rail" role="group" aria-label="Product categories"></div>';
  const rail = section.querySelector(".catalog-category-rail");
  const reset = section.querySelector(".catalog-discovery-reset");
  const products = [...grid.querySelectorAll(".product-card")];
  const names = new Map([...select.options].map(o => [o.value, o.textContent.trim()]));
  const groups = new Map();
  for (const card of products) {
    const key = card.dataset.category || "";
    if (!key) continue;
    const group = groups.get(key) || {count:0, photo:card.querySelector("img")?.getAttribute("src")||""};
    group.count++;
    groups.set(key,group);
  }

  const tiles = [];
  for (const [key, group] of groups) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "catalog-category-tile";
    tile.dataset.category = key;
    tile.setAttribute("aria-pressed","false");
    const photo = document.createElement("span");
    photo.className="catalog-category-photo";
    const image = document.createElement("img");
    image.src = group.photo;
    image.alt = "";
    image.loading="lazy";
    photo.append(image);
    const info = document.createElement("span");
    info.className="catalog-category-info";
    const label = document.createElement("strong");
    label.textContent=names.get(key)||key.replace(/-/g," ");
    const quantity = document.createElement("small");
    quantity.textContent=group.count+" product"+(group.count===1?"":"s");
    info.append(label,quantity);
    tile.append(photo,info);
    tile.addEventListener("click",()=>{
      search.value="";
      select.value=key;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      // Existing catalog filtering and pagination stay responsible for the results.
    });
    rail.append(tile);
    tiles.push(tile);
  }
  const sync = () => {
    for (const tile of tiles) {
      const active=tile.dataset.category===select.value;
      tile.classList.toggle("is-active",active);
      tile.setAttribute("aria-pressed",String(active));
    }
    reset.disabled=select.value==="all"&&!search.value.trim();
  };
  const clear=()=>{
    search.value="";
    select.value="all";
    select.dispatchEvent(new Event("change",{bubbles:true}));
    search.dispatchEvent(new Event("input",{bubbles:true}));
  };
  reset.addEventListener("click",clear);
  select.addEventListener("change",sync);
  search.addEventListener("input",sync);
  sync();
  hero.insertAdjacentElement("afterend",section);
});
