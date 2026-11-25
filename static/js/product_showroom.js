document.addEventListener("DOMContentLoaded", async () => {
  "use strict";
  const root = document.getElementById("showroom");
  if (!root) return;
  const $ = id => document.getElementById(id);
  const grid = $("showroomGrid"), category = $("showroomCategory"), search = $("showroomSearch");
  const count = $("showroomCount"), more = $("showroomLoadMore"), empty = $("showroomEmpty");
  const detail = $("showroomDialog"), selectionsDialog = $("showroomSelectionsDialog");
  const safe = value => String(value || "");
  const labelFor = code => code.replace(/-/g, " ").replace(/\b\w/g, s => s.toUpperCase());
  const storageKey = "qcmc-catalog-selections";
  let products = [], material = "all", visible = 12, selected = null;
  const getState = () => { try {const s = JSON.parse(sessionStorage.getItem(storageKey) || "{}");return {inquiry:Array.isArray(s.inquiry)?s.inquiry:[],compare:Array.isArray(s.compare)?s.compare:[]};}catch{return {inquiry:[],compare:[]};} };
  const saveState = state => { try {sessionStorage.setItem(storageKey,JSON.stringify(state));}catch{} };
  const categoryFor = p => category.querySelector('option[value="' + CSS.escape(p.category) + '"]')?.textContent || labelFor(p.category);
  const applicationFor = p => {
    if(p.line === "plastic"){
      if(["kubyertos","pet-cups","pp-bowl","sauce-cups","traditional-cups","ice-cream-cups"].includes(p.category)) return "Dinnerware";
      if(p.category==="lids") return "Packaging component";
      return "Food & industrial packaging";
    }
    if(["industrial","cooler"].includes(p.category)) return "Industrial & transport";
    if(["eps-psp-bowl","noodle-cup","plates","styrocup"].includes(p.category)) return "Dinnerware";
    return "Food packaging";
  };
  const toStored = p => ({id:p.id,name:p.name,code:p.code||"N/A",category:p.categoryName,application:applicationFor(p),material:p.line==="plastic"?"Plasticware / PET & PP lines":"Styroware / EPS & PSP lines",image:p.image});
  const catalogUrl = p => p.path + "?search=" + encodeURIComponent(p.name) + "&category=" + encodeURIComponent(p.category);
  const updateSelection = () => {
    const s=getState(), total=new Set([...s.inquiry,...s.compare].map(p=>p.id)).size;
    $("showroomSelection").hidden = total===0;
    $("showroomSelectionLabel").textContent = s.inquiry.length+" inquiry · "+s.compare.length+" compare";
    if(selected){const item=toStored(selected);
      $("showroomAddInquiry").textContent=s.inquiry.some(p=>p.id===item.id)?"Remove from inquiry":"Add to inquiry";
      $("showroomAddCompare").textContent=s.compare.some(p=>p.id===item.id)?"Remove comparison":"Compare";
    }
  };
  const toggleSelection = (type,max) => {
    if(!selected)return;
    const s=getState(), item=toStored(selected), idx=s[type].findIndex(p=>p.id===item.id);
    if(idx>=0)s[type].splice(idx,1);
    else if(s[type].length>=max){$("showroomDialogStatus").textContent="You can select up to "+max+" products.";return;}
    else s[type].push(item);
    saveState(s);updateSelection();$("showroomDialogStatus").textContent=idx>=0?"Removed from "+type+".":"Added to "+type+".";
  };
  function openDetails(p){
    selected=p;$("showroomDialogName").textContent=p.name;
    $("showroomDialogCode").textContent=p.code?"Product code: "+p.code:"";
    $("showroomDialogCategory").textContent=p.categoryName;
    $("showroomDialogMaterial").textContent=p.line==="plastic"?"Plasticware":"Styroware";
    $("showroomDialogImage").src=p.image;$("showroomDialogImage").alt=p.name;
    $("showroomOpenCatalog").href=catalogUrl(p);
    $("showroomDialogStatus").textContent="";updateSelection();detail.showModal();
  }
  function render(reset=false) {
    if(reset)visible=12;
    const query=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filter=category.value, sort=$("showroomSort").value;
    let matches=products.filter(p=>(material==="all"||material===p.line)
      &&(filter==="all"||filter===p.line+":"+p.category)
      &&query.every(word=>(p.name+" "+p.code+" "+p.categoryName+" "+p.line).toLowerCase().includes(word)));
    if(sort==="name")matches.sort((a,b)=>a.name.localeCompare(b.name));
    if(sort==="name-desc")matches.sort((a,b)=>b.name.localeCompare(a.name));
    count.textContent=matches.length+" product"+(matches.length===1?"":"s")+" found";
    grid.replaceChildren();
    matches.slice(0,visible).forEach(p=>{
      const card=document.createElement("article");card.className="showroom-card";
      const photo=document.createElement("button");photo.type="button";photo.className="showroom-card-photo";photo.setAttribute("aria-label","View "+p.name);
      const img=document.createElement("img");img.src=p.image;img.alt=p.name;img.loading="lazy";img.decoding="async";photo.append(img);photo.addEventListener("click",()=>openDetails(p));
      const info=document.createElement("div");info.className="showroom-card-info";
      const tag=document.createElement("small");tag.textContent=(p.line==="plastic"?"Plasticware":"Styroware")+" / "+p.categoryName;
      const title=document.createElement("h3");title.textContent=p.name;
      const code=document.createElement("p");code.textContent=p.code?"Code: "+p.code:"";
      const actions=document.createElement("div");actions.className="showroom-card-actions";
      const details=document.createElement("button");details.type="button";details.textContent="Quick view";details.addEventListener("click",()=>openDetails(p));
      const link=document.createElement("a");link.href=catalogUrl(p);link.textContent="Catalog →";
      actions.append(details,link);info.append(tag,title,code,actions);card.append(photo,info);grid.append(card);
    });
    empty.hidden=matches.length!==0;
    more.hidden=visible>=matches.length;more.textContent="Show more products ("+Math.min(12,matches.length-visible)+")";
  }
  async function loadCatalog(path,line){
    const response=await fetch(path,{credentials:"same-origin"});
    if(!response.ok)throw new Error("Unable to load "+line+" products");
    const doc=new DOMParser().parseFromString(await response.text(),"text/html");
    const options=new Map([...doc.querySelectorAll("#categoryFilter option")].map(o=>[o.value,o.textContent.trim()]));
    const cards=[...doc.querySelectorAll("#productsGrid .product-card")];
    if(!cards.length)throw new Error("No product cards found");
    return cards.map((card,index)=>{
      const name=safe(card.dataset.name||card.querySelector("img")?.alt||"Product");
      const code=safe(card.dataset.code||"");
      const cat=safe(card.dataset.category||"");
      const image=card.querySelector("img")?.getAttribute("src")||"";
      return {id:line+":"+name+":"+code,name,code,category:cat,categoryName:options.get(cat)||labelFor(cat),line,path,image,index};
    });
  }
  root.querySelectorAll("[data-material]").forEach(btn=>btn.addEventListener("click",()=>{
    material=btn.dataset.material;
    root.querySelectorAll("[data-material]").forEach(b=>{b.classList.toggle("is-active",b===btn);b.setAttribute("aria-pressed",String(b===btn));});
    category.value="all";updateCategories();render(true);
  }));
  function updateCategories(){
    const previous=category.value;
    const categories=[...new Map(products.filter(p=>material==="all"||p.line===material).map(p=>[p.line+":"+p.category,{key:p.line+":"+p.category,label:p.categoryName,line:p.line}])).values()]
      .sort((a,b)=>a.label.localeCompare(b.label));
    category.replaceChildren(new Option("All categories","all"));
    categories.forEach(c=>category.add(new Option(c.label+(material==="all"?" / "+(c.line==="plastic"?"Plasticware":"Styroware"):""),c.key)));
    category.value=[...category.options].some(o=>o.value===previous)?previous:"all";
  }
  [search,category,$("showroomSort")].forEach(el=>el.addEventListener(el===search?"input":"change",()=>render(true)));
  more.addEventListener("click",()=>{visible+=12;render();});
  $("showroomClose").addEventListener("click",()=>detail.close());
  detail.addEventListener("click",e=>{if(e.target===detail)detail.close();});
  $("showroomAddInquiry").addEventListener("click",()=>toggleSelection("inquiry",8));
  $("showroomAddCompare").addEventListener("click",()=>toggleSelection("compare",3));
  $("showroomViewSelection").addEventListener("click",()=>{
    const s=getState(), box=$("showroomSelectionsList");box.replaceChildren();
    for(const [type,items] of [["Inquiry",s.inquiry],["Compare",s.compare]]){
      const title=document.createElement("h3");title.textContent=type+" ("+items.length+")";box.append(title);
      items.forEach(item=>{const line=document.createElement("div");line.className="showroom-selection-row";
        const img=document.createElement("img");img.src=item.image;img.alt="";
        const p=document.createElement("span");p.textContent=item.name;
        const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.addEventListener("click",()=>{
          const latest=getState();latest[type.toLowerCase()]=latest[type.toLowerCase()].filter(p=>p.id!==item.id);saveState(latest);line.remove();updateSelection();
        });
        line.append(img,p,remove);box.append(line);
      });
    }
    const destination = s.inquiry.length && s.inquiry.every(item => item.id.startsWith("styro:"))
      ? "/products_styro?inquiry=1" : "/products_plastic?inquiry=1";
    $("showroomContactLink").href = destination;
    selectionsDialog.showModal();
  });
  $("showroomSelectionsClose").addEventListener("click",()=>selectionsDialog.close());
  selectionsDialog.addEventListener("click",e=>{if(e.target===selectionsDialog)selectionsDialog.close();});
  $("showroomContactLink").addEventListener("click",()=>selectionsDialog.close());
  try {
    const catalogs=await Promise.all([loadCatalog("/products_plastic","plastic"),loadCatalog("/products_styro","styro")]);
    products=catalogs.flat();
    updateCategories();render();updateSelection();
  } catch(err) {
    count.textContent="Catalog temporarily unavailable";
    $("showroomBackup").hidden=false;
    console.error("Product showroom:",err);
  }
});
