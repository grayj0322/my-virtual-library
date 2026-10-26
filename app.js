const $=id=>document.getElementById(id);
const KEY="mvl-v2-books";
let books=load(), filter="all", editing=null, stream=null, raf=null;

function load(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(books));render()}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function open(id){$(id).showModal()}
function close(id){if($(id).open)$(id).close()}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));

function render(){
 $("bookCount").textContent=`${books.length} ${books.length===1?"book":"books"}`;
 $("waitingCount").textContent=`${books.filter(b=>b.status==="waiting").length} waiting`;
 const q=($("searchInput")?.value||"").trim().toLowerCase();
 const list=books.filter(b=>{
  const text=[b.title,b.author,b.isbn,b.genre,b.description].join(" ").toLowerCase();
  return (!q||text.includes(q))&&(filter==="all"||b.status===filter);
 });
 const shelf=$("bookshelf"), empty=$("emptyMessage"); shelf.innerHTML="";
 empty.hidden=list.length>0;
 list.forEach(b=>{
  const el=document.createElement("button");el.className="book"+(b.cover?" cover":"");
  if(b.cover)el.style.backgroundImage=`url("${b.cover.replace(/"/g,"%22")}")`;
  el.innerHTML=`<span class="book-title">${esc(b.title||"Untitled")}</span><span class="book-author">${esc(b.author||"")}</span>`;
  el.onclick=()=>details(b.id);shelf.appendChild(el);
 });
 renderList();
}
function renderList(){
 const q=($("searchInput")?.value||"").trim().toLowerCase();
 const list=books.filter(b=>{
  const text=[b.title,b.author,b.isbn,b.genre,b.description].join(" ").toLowerCase();
  return (!q||text.includes(q))&&(filter==="all"||b.status===filter);
 });
 $("bookList").innerHTML=list.length?list.map(b=>`<article class="list-book"><img class="list-cover" src="${esc(b.cover||"")}" alt="" onerror="this.style.visibility='hidden'"><div><h3>${esc(b.title)}</h3><p>${esc(b.author||"Unknown author")} · ${esc(b.isbn||"No ISBN")}<br>${esc(b.status||"owned")} ${b.genre?"· "+esc(b.genre):""}</p></div><button data-id="${esc(b.id)}">View</button></article>`).join(""):`<p style="font:13px system-ui;color:#776b5e">No books match your search.</p>`;
 $("bookList").querySelectorAll("button").forEach(b=>b.onclick=()=>details(b.dataset.id));
}

function resetForm(){
 editing=null;$("addForm").reset();$("formTitle").textContent="Add a book";$("lookupNote").textContent="We'll fill in the title, author, year, and cover when available.";
 $("scanArea").hidden=true;stopScan();
}
function addBook(){resetForm();open("addDialog")}
$("emptyAdd").onclick=addBook;
$("editButton").onclick=()=>open("settingsDialog");
$("collectionButton").onclick=()=>open("collectionDialog");
$("backupButton").onclick=()=>{
 const blob=new Blob([JSON.stringify({version:2,books},null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my-virtual-library-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast("Backup exported");
};
$("viewButton").onclick=()=>{filter="all";$("panelTitle").textContent="My Books";$("panelKicker").textContent="YOUR COLLECTION";$("panel").hidden=false;renderList();$("searchInput").focus()};
$("closePanel").onclick=()=>{$("panel").hidden=true};
$("searchInput").oninput=renderList;
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderList()});
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{
 const page=b.dataset.page;
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 if(page==="books"){ $("panelTitle").textContent="My Books";$("panelKicker").textContent="YOUR COLLECTION";$("panel").hidden=false;renderList()}
 else if(page==="reading"){ $("panel").hidden=true }
 else if(page==="bookshelf"){ $("panel").hidden=true;toast("You're already viewing your bookshelf")}
 else if(page==="journal"){ $("panelTitle").textContent="Journal";$("panelKicker").textContent="YOUR READING JOURNAL";$("panel").hidden=false;$("bookList").innerHTML="<p style='font:13px system-ui;color:#776b5e'>Journal entries are coming next. We'll use this space for reading notes, ratings, and favorite quotes.</p>"}
});

$("addForm").onsubmit=e=>{
 e.preventDefault();
 const b={id:editing||uid(),title:$("title").value.trim(),author:$("author").value.trim(),isbn:$("isbn").value.trim(),year:$("year").value.trim(),status:$("status").value,genre:$("genre").value.trim(),cover:$("cover").value.trim(),description:$("description").value.trim(),createdAt:editing?(books.find(x=>x.id===editing)?.createdAt||Date.now()):Date.now()};
 if(!b.title){toast("Please enter a title");return}
 books=editing?books.map(x=>x.id===editing?b:x):[...books,b];save();close("addDialog");toast(editing?"Book updated":"Book added");
};
async function lookupISBN(value){
 const isbn=value.replace(/[-\s]/g,"");if(!isbn)return toast("Enter an ISBN first");
 $("lookupNote").textContent="Looking up the book…";
 try{
  const r=await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`);
  const d=await r.json(),item=d[`ISBN:${isbn}`];
  if(item){fillFrom(item,isbn);$("lookupNote").textContent="Found it. Check the edition details and save.";return}
  const s=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(isbn)}&limit=1`);
  const sd=await s.json(),doc=sd.docs?.[0];
  if(doc){fillFromSearch(doc,isbn);$("lookupNote").textContent="Found a possible match. Verify the edition before saving.";return}
  $("lookupNote").textContent="No match found. You can enter the details manually.";
 }catch(e){$("lookupNote").textContent="The book catalog couldn't be reached. You can still enter the book manually."}
}
function fillFrom(item,isbn){
 $("title").value=item.title||"";$("author").value=(item.authors||[]).map(a=>a.name).join(", ");$("isbn").value=isbn;
 $("year").value=(item.publish_date||"").match(/\d{4}/)?.[0]||"";
 $("description").value=item.notes?.value||"";
 const c=item.cover?.large||item.cover?.medium||item.cover?.small||"";$("cover").value=c;
}
function fillFromSearch(d,isbn){
 $("title").value=d.title||"";$("author").value=(d.author_name||[]).join(", ");$("isbn").value=isbn;$("year").value=d.first_publish_year||"";
 if(d.cover_i)$("cover").value=`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
}
$("lookupButton").onclick=()=>lookupISBN($("isbnLookup").value);
$("isbnLookup").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();lookupISBN($("isbnLookup").value)}};

async function startScan(){
 if(!("BarcodeDetector" in window)){toast("Barcode scanning isn't supported here. Enter the ISBN instead.");return}
 try{
  const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e"]});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  $("video").srcObject=stream;$("scanArea").hidden=false;await $("video").play();
  const loop=async()=>{if(!stream)return;try{const found=await detector.detect($("video"));if(found.length){$("isbnLookup").value=found[0].rawValue;stopScan();await lookupISBN(found[0].rawValue);return}}catch{}raf=requestAnimationFrame(loop)};loop();
 }catch{toast("Camera access failed. Allow camera access or enter the ISBN manually.")}
}
function stopScan(){if(raf)cancelAnimationFrame(raf);raf=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}if($("video"))$("video").srcObject=null}
$("scanButton").onclick=startScan;$("stopScan").onclick=()=>{stopScan();$("scanArea").hidden=true};

function details(id){
 const b=books.find(x=>x.id===id);if(!b)return;
 $("detailDialog").innerHTML=`<div class="dialog-head"><div><span class="section-kicker">BOOK DETAILS</span><h2>${esc(b.title)}</h2></div><button class="x" data-close="detailDialog">×</button></div><div class="detail">${b.cover?`<img src="${esc(b.cover)}" alt="">`:`<div class="list-cover"></div>`}<div><p><b>${esc(b.author||"Unknown author")}</b><br>${b.year?"Published "+esc(b.year)+"<br>":""}${b.isbn?"ISBN "+esc(b.isbn)+"<br>":""}${b.genre?"Shelf: "+esc(b.genre)+"<br>":""}Status: ${esc(b.status||"owned")}</p><p>${esc(b.description||"No notes yet.")}</p><button class="dark-button" id="editCurrent">Edit book</button> <button class="light-button" id="removeCurrent">Remove</button></div></div>`;
 $("detailDialog").querySelector("[data-close]").onclick=()=>close("detailDialog");
 $("editCurrent").onclick=()=>{close("detailDialog");editing=b.id;$("formTitle").textContent="Edit book";["title","author","isbn","year","status","genre","cover","description"].forEach(k=>$(k).value=b[k]||"");open("addDialog")};
 $("removeCurrent").onclick=()=>{if(confirm(`Remove "${b.title}"?`)){books=books.filter(x=>x.id!==id);save();close("detailDialog");toast("Book removed")}};
 open("detailDialog");
}

document.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{document.body.dataset.theme=b.dataset.theme;localStorage.setItem("mvl-theme",b.dataset.theme);toast("Theme changed")});
$("largeSpines").onchange=e=>document.body.classList.toggle("large-spines",e.target.checked);
$("decorations").onchange=e=>document.body.classList.toggle("no-decor",!e.target.checked);
document.querySelectorAll(".collection-choice").forEach(b=>b.onclick=()=>{if(!b.id){$("collectionName").textContent=b.firstChild.textContent.trim();close("collectionDialog");toast("Collection changed")}});

const savedTheme=localStorage.getItem("mvl-theme")||"wood";document.body.dataset.theme=savedTheme;
render();
