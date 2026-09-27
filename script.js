/*
Sattv Shah
dish-box
*/

const STORAGE_KEY = 'dish-box-data-v2';

const defaultData = {
  categories: ['Mexican', 'Italian', 'Indian'],
  dishes: [
    { id: 'd1', name: 'Dosa', cat: 'Indian', checked: false, cookedAt: null },
    { id: 'd2', name: 'Taco', cat: 'Mexican', checked: false, cookedAt: null },
    { id: 'd3', name: 'Pesto Pasta', cat: 'Italian', checked: false, cookedAt: null },
    { id: 'd4', name: 'Pizza', cat: 'Italian', checked: false, cookedAt: null },
  ]
};
// Each dish object: id (unique string), name, cat (cuisine), checked
// (true while it's in "cooking this week"), cookedAt (null, or a
// timestamp once it's been taken OUT of "cooking this week" — that's
// what "recently cooked" is built from).

// ---- APP STATE ----
let data = loadData(); 
let activeFilter = 'All';                             // which cuisine tab is selected
let selectedCat = data.categories[0] || null;         // last-used cuisine in the dropdown
let editingCatsOpen = false;                          // is the "Edit cuisines" panel open?


//elements used outside of funtions
const addBtn = document.getElementById(`addBtn`);     
const nameInput = document.getElementById(`newName`);
const addCatBtn = document.getElementById(`saveNewCat`);     
const catNameInput = document.getElementById(`newCatName`);
const editCatsBtn = document.getElementById('editCatsBtn');
const dishError = document.getElementById(`dishError`);
const catError = document.getElementById(`catError`);


/* ===========================================================================
   storage + small helpers
   =========================================================================== */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Load failed', e);
  }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Save failed', e);
  }
}

function uid() {
  return 'd' + Math.random().toString(36).slice(2, 9);
}

// Prevents typed text from being read as HTML. Wrap any user-typed text
// with this before inserting it into innerHTML.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Turns a timestamp into "today" / "1 day ago" / "5 days ago".
function daysAgoText(timestamp) {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return new Date(timestamp).toLocaleDateString();
}


/* ===========================================================================
   RENDER — the master redraw function.
   =========================================================================== */

function render() {
  renderCatSelect();
  renderTabs();
  renderCatManageList();
  renderGroups();
  renderWeekList();
  renderRecentList();
  saveData();
}


/* ===========================================================================
   Fills in the <select id="newCat"> dropdown with one <option> per
   cuisine in data.categories.
   =========================================================================== */
function renderCatSelect() {
   const sel = document.getElementById('newCat');

   //if selectedCat dosnt exsist, set it to first in categories or null
   if (!selectedCat || !data.categories.includes(selectedCat)){
      selectedCat = data.categories[0] || null;
   }

   //put all cats in the dropdown
   sel.innerHTML = data.categories.map(c => `<option value="${c}">${c}</option>`).join('');

   // Show the dropdown's currently-selected option to match selectedCat's value
   sel.value = selectedCat;
   // When the user manually picks a different option, update selectedCat to match
   sel.onchange = () => {
      selectedCat = sel.value;
   }
}


/* ===========================================================================
   Fills in the <div id="tabs"> with one button per cuisine, plus an
   "All" button at the start. Clicking a tab sets `activeFilter` and
   re-renders.
   =========================================================================== */
function renderTabs() {
   const container = document.getElementById('tabs');
   const cats = ['All', ...data.categories]; //gets all cats plus an 'All'

   //makes buttons for each cat and and 'All button
   container.innerHTML = cats.map(c => `
   <button class="tab ${c === activeFilter ? 'active' : ''}">${c}</button>
   `).join('');

   //makes activefilter = whatever button was clicked
   container.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
         activeFilter = btn.textContent;
         render();
      })
   });
}


/* ===========================================================================
builds the actual dish checklist, grouped by cuisine.
   =========================================================================== */
function renderGroups() {
   const container = document.getElementById(`groups`);
   let allHTML = '';

   let catsToShow = activeFilter === 'All' ? data.categories : [activeFilter] //what cats to show based on filter


   for (const cat of catsToShow) {
      const dishesInCat = data.dishes.filter(r => r.cat === cat); //all dises in that cat
      allHTML += `<h2>${cat}</h2>`;
      if (dishesInCat.length === 0) {
         allHTML += `<p class="empty">no dishes yet</p>`; //if not dishes in cat

      }else{
         //adds a checkbox, the dish name, time it was cooked at if valid, and x button
         allHTML += dishesInCat.map(r => `
            <div ${r.checked ? 'class="item checked"' : 'class="item"'}>
               <input type="checkbox" id="${r.id}" data-id="${r.id}" ${r.checked ? 'checked' : ''}/>
               <label for="${r.id}">${escapeHtml(r.name)}</label>
               ${r.cookedAt ? `<span class="recent-badge">${daysAgoText(r.cookedAt)}</span>` : ''}
               <button class="del-btn" data-id="${r.id}">&times;</button>
            </div>
            `).join('');
      }
   }
   //combines all parts into the html
   container.innerHTML = allHTML;

   //checks the box if it was checked, and sets cookedAt time to now if unchecked
   container.querySelectorAll('input[type="checkbox"]').forEach(box => {
      box.addEventListener(`change`, () => {
         const dish = data.dishes.find( r => r.id === box.dataset.id);
         dish.checked = box.checked;
         if (!box.checked) {
            dish.cookedAt = Date.now();
         }
         render();
      })
   })

   //gets rid of dish x button clicked
   container.querySelectorAll(`.del-btn`).forEach(btn => {
      btn.addEventListener(`click`, () => {
         data.dishes = data.dishes.filter(r => r.id !== btn.dataset.id);
         render();
      })
   })
}


/* ===========================================================================
   Fills the sidebar's "cooking this week" list with whichever dishes
   currently have checked === true.
   =========================================================================== */
function renderWeekList() {
   const list = document.getElementById(`weekList`);
   const count = document.getElementById(`weekCount`);

   //all dishes on cooking this week list
   const weekList = data.dishes.filter(r => r.checked);

   //shows how many dishes are in the list
   count.innerHTML = weekList.length === 0 ? 'Nothing planned yet' :
   `${weekList.length} dish${weekList.length === 1 ? '' : 'es'} planned`;

   //shows each dish with the cat, and an x next to it
   list.innerHTML = weekList.map(w => `
      <div class="week-item">
         <label>${escapeHtml(w.name)}</label>
         <span class="tag">${escapeHtml(w.cat)}</span>
         <button class="del-btn" data-id="${w.id}">&times;</button>
      </div>
   `).join('');
   
   //takes dish off list, unchecks dish, and sets cookedAt time to now when x is pressed
   list.querySelectorAll(`.del-btn`).forEach(btn => {
      btn.addEventListener(`click`, () => {
         const dish = data.dishes.find( r => r.id === btn.dataset.id);
         dish.checked = false;
         dish.cookedAt = Date.now();
         render();
      })
   })
}


/* ===========================================================================
   Fills the sidebar's "recently cooked" list.
   =========================================================================== */
function renderRecentList() {
   const list = document.getElementById(`recentList`);
   const count = document.getElementById(`recentCount`);

   //all dishes on recently cooked list sorted by most to least recent
   const recentList = data.dishes.filter(r => r.cookedAt !== null).sort((a, b) =>b.cookedAt - a.cookedAt); 

   //shows how many dishes are in the list
   count.innerHTML = recentList.length === 0 ? 'Nothing here yet' :
   `${recentList.length} dish${recentList.length === 1 ? '' : 'es'} cooked recently`;

   //shows each dish with the cat, time stamp and an x next to it
   list.innerHTML = recentList.map(r => `
      <div class="recent-item">
         <label>${escapeHtml(r.name)}</label>
         <span class="meta">${escapeHtml(r.cat)} ·
         <span class="days">${daysAgoText(r.cookedAt)}</span></span>
         <button class="del-btn" data-id="${r.id}">&times;</button>
      </div>
   `).join('');

   //resets cookedAt value if x is clicked
   list.querySelectorAll(`.del-btn`).forEach(btn => {
      btn.addEventListener(`click`, () => {
         const dish = data.dishes.find( r => r.id === btn.dataset.id);
         dish.cookedAt = null;
         render();
      })
   })

}


/* ===========================================================================
   Fills the "Edit cuisines" panel: shown/hidden based on editingCatsOpen,
   and when shown, lists every cuisine with a delete button.
   =========================================================================== */
function renderCatManageList() {
   const catsPanel = document.getElementById(`editCatsPanel`)
   const catList = document.getElementById(`catManageList`)

   catsPanel.classList.toggle('show',editingCatsOpen) //show panel when click to open

   editCatsBtn.innerHTML =  editingCatsOpen ? 'Done' : 'Edit Cuisines'; //change what button says

   //only do if panel is open
   if (editingCatsOpen) {
      //show each cat and an x button
      catList.innerHTML = data.categories.map(c => `
            <div class="cat-manage-item">
               <label>${escapeHtml(c)}</label>
               <button class="del-btn" data-id="${c}">&times;</button>
            </div>
            `).join('');
         
      //result of pressing x
      catList.querySelectorAll(`.del-btn`).forEach(btn => {
      btn.addEventListener(`click`, () => {
         const amount = data.dishes.filter(r => r.cat === btn.dataset.id).length //amount of dishes under the cat
         const ok = amount === 0 ? true : confirm(`Are you sure, there ${amount === 1 ? 'is' : 'are'} ${amount} dish${amount === 1 ? '' : 'es'} under this cuisine`) //confirmation to deleate the cat
         if (ok) {
            //get rid of selected cat and all dises under that cat
            data.categories = data.categories.filter( c => c !== btn.dataset.id);
            data.dishes = data.dishes.filter(r => r.cat !== btn.dataset.id);
            
            //set filter to default if it was on deleated cat
            if (activeFilter === btn.dataset.id) {
               activeFilter = 'All';
            }
            //set selectedcat to default if it was on deleated cat
            if (selectedCat === btn.dataset.id) {
               selectedCat = data.categories[0] || null;
            }
            
            render();
         }
         
      })
   })
   }

}


/* =========================
   ONE-TIME EVENT LISTENERS
   ========================= */

//adds gets name entered and adds it to the list
function addDish() {
   const dishName = nameInput.value.trim(); 

   // if a duplicate is entered
   if (data.dishes.some(r => r.name === dishName && r.cat === selectedCat)){
      dishError.innerHTML = 'That dish already exists.';
      dishError.classList.add('show');
      nameInput.focus();

   //if nothing is entered
   }else if (dishName === '') {
      nameInput.focus();
      dishError.innerHTML = '';
      dishError.classList.remove('show');

   //if something valid is entered
   }else{
      data.dishes.push({ 
         id: uid(),
         name: dishName,
         cat: selectedCat,
         checked: false,
         cookedAt: null
      })
      
      nameInput.value = '';
      nameInput.focus();
      dishError.innerHTML = '';
      dishError.classList.remove('show');
      render();
   }
}

//adds dish if enter button is clicked
addBtn.addEventListener(`click`, () => {
   addDish();
})

//adds dish if enter key is pressed
nameInput.addEventListener(`keydown`, (e) => {
   if (e.key === 'Enter') {
      addDish();
   }
})

//if button clicked then change state; open/closed
editCatsBtn.addEventListener(`click`, () =>{
   editingCatsOpen = !editingCatsOpen;
   render();
})


//adds gets name entered and adds it to the cuisine list
function addCuisine() {
   const catName = catNameInput.value.trim(); 

   // if a duplicate is entered
   if (data.categories.some(c => catName === c)) {
      catError.innerHTML = 'That cuisine already exists.';
      catNameInput.focus();
   
   // if nothing is entered
   }else if (catName === '') {
      catError.innerHTML = '';
      catNameInput.focus();

   //if something valid is entered
   }else {
      data.categories.push(catName)
      
      catNameInput.value = ''; //clears input field
      catNameInput.focus();
      catError.innerHTML = '';
      render();
   }
}

//adds cuisine if enter button is clicked
addCatBtn.addEventListener(`click`, () => {
   addCuisine();
})

//adds cuisine if enter key is pressed
catNameInput.addEventListener(`keydown`, (e) => {
   if (e.key === 'Enter') {
      addCuisine();
   }
})

const listToggle = document.getElementById('listToggle');
const listContent = document.getElementById('listContent');

listToggle.addEventListener('click', () => {
   listContent.classList.toggle('collapsed');
   listToggle.classList.toggle('collapsed');
});


// Draws the screen for the first time when the page loads.
render();
