/*
Sattv Shah
dish-box
*/

/* ===========================================================================
   CONTENTS
     1.  Constants
     2.  App state (variables that change while the app runs)
     3.  Page elements
     4.  Storage + small helpers
     5.  Undo toast
     6.  Recently deleted (trash)
     7.  Actions (add / check / delete dishes and cuisines)
     8.  Render functions (draw the screen)
     9.  Recipe page
    10.  Backup + restore
    11.  Theme picker
    12.  Event listeners (all the one-time wiring)
    13.  Startup
   =========================================================================== */


/* ===========================================================================
   1. CONSTANTS
   =========================================================================== */

const STORAGE_KEY = 'dish-box-data-v2';   // localStorage key the app saves under
const TRASH_DAYS = 30;                    // how long deleted items can be put back

// What the app starts with the very first time it opens (nothing saved yet).
// Each dish object: id (unique string), name, cat (cuisine), checked
// (true while it's in "cooking this week"), cookedAt (null, or a
// timestamp once it's been taken OUT of "cooking this week" — that's
// what "recently cooked" is built from).
const defaultData = {
  categories: ['Mexican', 'Italian', 'Indian', 'Shaak'],
  dishes: [
    { id: 'd1', name: 'Dosa', cat: 'Indian', checked: false, cookedAt: null },
    { id: 'd2', name: 'Taco', cat: 'Mexican', checked: false, cookedAt: null },
    { id: 'd3', name: 'Bataka', cat: 'Shaak', checked: false, cookedAt: null },
    { id: 'd4', name: 'Pizza', cat: 'Italian', checked: false, cookedAt: null },
  ]
};

// Recipe cleanup rules (used by sanitizeHtml):
// only these tags survive; TAG_MAP turns other tags into allowed ones
const ALLOWED_TAGS = new Set(['strong', 'ul', 'ol', 'li', 'h3', 'p', 'br']);
const TAG_MAP = { b: 'strong', h1: 'h3', h2: 'h3', h4: 'h3', h5: 'h3', h6: 'h3', div: 'p' };

// Recipe toolbar: which browser command each button runs (heading is handled separately)
const FORMAT_CMD = { bullet: 'insertUnorderedList', number: 'insertOrderedList', bold: 'bold' };

// Color themes for the "Change theme" menu.
//   key  = the data-theme name used in style.css
//   a, b = the two colors shown in that theme's round swatch (background + main color)
// 'auto' has no theme of its own: it follows the device's light/dark setting.
const THEME_KEY = 'dish-box-theme';       // localStorage key (separate from the dish data)
const THEMES = [
  { key: 'auto',         name: 'Auto',         a: '#F4EDE4', b: '#211A14' },
  { key: 'classic',      name: 'Classic',      a: '#F4EDE4', b: '#C1502E' },
  { key: 'classic-dark', name: 'Classic dark', a: '#211A14', b: '#E17A52' },
  { key: 'ocean',        name: 'Ocean',        a: '#EAF1F5', b: '#2B7BA8' },
  { key: 'ocean-dark',   name: 'Ocean dark',   a: '#121C22', b: '#3F97C4' },
  { key: 'plum',         name: 'Plum',         a: '#F3ECF2', b: '#A63F7C' },
  { key: 'plum-dark',    name: 'Plum dark',    a: '#1D1620', b: '#C25A93' },
];

// phones, tablets, and Macs get the share menu for backups; everything else just copies
const useShareMenu = /iPhone|iPad|iPod|Android|Macintosh/.test(navigator.userAgent) && navigator.share;


/* ===========================================================================
   2. APP STATE
   =========================================================================== */

let data = loadData();                                // { categories, dishes, trash }

// dish list screen
let activeFilter = 'All';                             // which cuisine tab is selected
let selectedCat = data.categories[0] || null;         // last-used cuisine in the dropdown
let editingCatsOpen = false;                          // is the "Edit cuisines" panel open?
let editingDishes = false;                            // is "Edit dishes" mode on (pencil + x buttons)?
let editingDishId = null;                             // id of the dish open in the edit window

// undo toast
let undoAction = null;                                // function to run if Undo is tapped
let toastTimer = null;                                // hides the toast after 7 seconds

// recipe page
let currentRecipeId = null;                           // id of the dish whose recipe is open
let saveTimer = null;                                 // delays saving while typing
let listScroll = 0;                                   // list scroll position, restored when coming back
let wakeLock = null;                                  // keeps the screen awake while a recipe is open
let savedRange = null;                                // last caret/selection inside the editor, restored if a button press steals focus

// theme
let currentTheme = loadTheme();                       // a key from THEMES ('auto' = follow the device)


/* ===========================================================================
   3. PAGE ELEMENTS
   (Elements used only inside one function are looked up in that function.)
   =========================================================================== */

// list screen
const listView = document.getElementById('listView');
const listToggle = document.getElementById('listToggle');       // the "Cooking List" title (collapses list on phones)
const listContent = document.getElementById('listContent');

// add dish
const nameInput = document.getElementById('newDish');
const addBtn = document.getElementById('addBtn');
const dishError = document.getElementById('dishError');

// edit buttons + cuisine editor
const editCatsBtn = document.getElementById('editCatsBtn');
const editDishesBtn = document.getElementById('editDishesBtn');
const catNameInput = document.getElementById('newCatInput');
const addCatBtn = document.getElementById('saveNewCat');
const catError = document.getElementById('catError');

// edit dish window
const editDishDialog = document.getElementById('editDishDialog');
const editDishName = document.getElementById('editDishName');
const editDishCat = document.getElementById('editDishCat');
const editDishError = document.getElementById('editDishError');

// undo toast
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const toastUndo = document.getElementById('toastUndo');

// recently deleted
const trashBtn = document.getElementById('trashBtn');
const trashDialog = document.getElementById('trashDialog');

// recipe page
const recipeView = document.getElementById('recipeView');
const recipeEditor = document.getElementById('recipeEditor');
const recipeTitle = document.getElementById('recipeTitle');
const recipeTag = document.getElementById('recipeTag');
const recipeEditBtn = document.getElementById('recipeEdit');
const recipeToolbar = document.getElementById('recipeToolbar');

// backup + restore
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const restoreDialog = document.getElementById('restoreDialog');
const restoreText = document.getElementById('restoreText');
const restoreError = document.getElementById('restoreError');

// theme picker
const themeBtn = document.getElementById('themeBtn');
const themeDialog = document.getElementById('themeDialog');


/* ===========================================================================
   4. STORAGE + SMALL HELPERS
   =========================================================================== */

// Reads saved data from localStorage; falls back to a fresh copy of defaultData
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

// Makes a new unique id for a dish
function uid() {
  return 'd' + Math.random().toString(36).slice(2, 9);
}

// Finds a dish by its id (undefined if there isn't one)
function findDish(id) {
  return data.dishes.find(r => r.id === id);
}

// Prevents typed text from being read as HTML. Wrap any user-typed text
// with this before inserting it into innerHTML.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Turns a timestamp into "today" / "yesterday" / a date like 9/21/2026.
function daysAgoText(timestamp) {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return new Date(timestamp).toLocaleDateString();
}

// "1 dish" / "3 dishes"
function dishCount(n) {
  return `${n} dish${n === 1 ? '' : 'es'}`;
}


/* ===========================================================================
   5. UNDO TOAST: a small "Deleted ... Undo" message at the bottom of the screen.
   showUndo(message, undoFn) runs undoFn if Undo is tapped within 7 seconds.
   =========================================================================== */

function showUndo(message, undoFn) {
  undoAction = undoFn;
  toastMsg.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 7000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  undoAction = null;
}


/* ===========================================================================
   6. RECENTLY DELETED (trash)
   Deleted dishes/cuisines are kept in data.trash for 30 days so they can be
   put back later. Entries look like:
     { type: 'dish', dish, idx, deletedAt }
     { type: 'cuisine', cat, catIdx, dishes: [{ d, i }], deletedAt }
   =========================================================================== */

// Makes sure data.trash exists and drops anything older than 30 days
function cleanTrash() {
  if (!Array.isArray(data.trash)) data.trash = [];
  const cutoff = Date.now() - TRASH_DAYS * 86400000;
  data.trash = data.trash.filter(t => t && t.deletedAt > cutoff);
}

function moveToTrash(entry) {
  entry.deletedAt = Date.now();
  data.trash.push(entry);
  return entry;
}

// Puts a trashed dish/cuisine back (does nothing if it was already put back)
function restoreFromTrash(entry) {
  if (!data.trash.includes(entry)) return;
  data.trash = data.trash.filter(t => t !== entry);
  if (entry.type === 'dish') {
    if (!data.categories.includes(entry.dish.cat)) data.categories.push(entry.dish.cat);
    data.dishes.splice(Math.min(entry.idx, data.dishes.length), 0, entry.dish);
  } else {
    if (!data.categories.includes(entry.cat)) {
      data.categories.splice(Math.min(entry.catIdx, data.categories.length), 0, entry.cat);
    }
    entry.dishes.forEach(x => data.dishes.splice(Math.min(x.i, data.dishes.length), 0, x.d));
  }
}

// "Recently deleted" button label, with a count when there is something in it
function renderTrashBtn() {
  trashBtn.textContent = data.trash.length ? `Recently deleted (${data.trash.length})` : 'Recently deleted';
}

// Fills the Recently deleted dialog, newest first, with put-back / delete-forever buttons
function renderTrashList() {
  const list = document.getElementById('trashList');
  if (data.trash.length === 0) {
    list.innerHTML = '<p class="empty">Nothing deleted recently.</p>';
    return;
  }
  const items = [...data.trash].reverse(); // newest first
  list.innerHTML = items.map((t, i) => {
    const name = t.type === 'dish' ? escapeHtml(t.dish.name) : `${escapeHtml(t.cat)} (cuisine)`;
    const detail = t.type === 'dish' ? escapeHtml(t.dish.cat) : dishCount(t.dishes.length);
    return `
      <div class="trash-item">
        <div>
          <div class="trash-name">${name}</div>
          <div class="trash-meta">${detail} · deleted ${daysAgoText(t.deletedAt)}</div>
        </div>
        <div class="trash-actions">
          <button type="button" class="trash-restore" data-i="${i}" aria-label="Put back ${name}" title="Put back">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </button>
          <button type="button" class="trash-delete" data-i="${i}" aria-label="Delete ${name} forever" title="Delete forever">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  // put back
  list.querySelectorAll('.trash-restore').forEach(btn => {
    btn.addEventListener('click', () => {
      restoreFromTrash(items[btn.dataset.i]);
      hideToast(); // the bottom Undo (if showing) could point at this same item
      render();
      renderTrashList();
    });
  });

  // delete forever (asks first, since there is no undo for this one)
  list.querySelectorAll('.trash-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = items[btn.dataset.i];
      const what = t.type === 'dish' ? `"${t.dish.name}"` : `the ${t.cat} cuisine and its dishes`;
      if (!confirm(`Delete ${what} forever? This can't be undone.`)) return;
      data.trash = data.trash.filter(x => x !== t);
      hideToast();
      render();
      renderTrashList();
    });
  });
}


/* ===========================================================================
   7. ACTIONS
   Things the user does to dishes and cuisines. Each one changes `data`,
   then calls render() to redraw.
   =========================================================================== */

// Reads the name box and adds it as a dish under the selected cuisine
function addDish() {
  const dishName = nameInput.value.trim();

  // if a duplicate is entered
  if (data.dishes.some(r => r.name === dishName && r.cat === selectedCat)) {
    dishError.innerHTML = 'That dish already exists.';
    dishError.classList.add('show');
    nameInput.focus();

  // if nothing is entered
  } else if (dishName === '') {
    nameInput.focus();
    dishError.innerHTML = '';
    dishError.classList.remove('show');

  // if something valid is entered
  } else {
    data.dishes.push({
      id: uid(),
      name: dishName,
      cat: selectedCat,
      checked: false,
      cookedAt: null
    });

    nameInput.value = '';
    nameInput.focus();
    dishError.innerHTML = '';
    dishError.classList.remove('show');
    render();
  }
}

// Reads the cuisine box and adds it to the cuisine list
function addCuisine() {
  const catName = catNameInput.value.trim();

  // if a duplicate is entered
  if (data.categories.some(c => catName === c)) {
    catError.innerHTML = 'That cuisine already exists.';
    catNameInput.focus();

  // if nothing is entered
  } else if (catName === '') {
    catError.innerHTML = '';
    catNameInput.focus();

  // if something valid is entered
  } else {
    data.categories.push(catName);

    catNameInput.value = ''; // clears input field
    catNameInput.focus();
    catError.innerHTML = '';
    render();
  }
}

// Opens the edit window for a dish, filled in with its current name + cuisine
function openEditDish(id) {
  const dish = findDish(id);
  if (!dish) return;
  editingDishId = id;
  editDishName.value = dish.name;
  editDishCat.innerHTML = data.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  editDishCat.value = dish.cat;
  editDishError.textContent = '';
  editDishDialog.showModal();
  editDishName.focus();
  editDishName.select();
}

// Save button in the edit window: renames and/or moves the dish, then offers Undo.
// It's the same dish object, so its recipe, checked state and cooked date all carry over.
function saveEditDish() {
  const dish = findDish(editingDishId);
  if (!dish) { editDishDialog.close(); return; }

  const newName = editDishName.value.trim();
  const newCat = editDishCat.value || dish.cat;

  // if nothing is entered
  if (newName === '') {
    editDishError.textContent = 'Enter a name.';
    editDishName.focus();
    return;
  }

  // if another dish in that cuisine already has this name
  if (data.dishes.some(r => r.id !== dish.id && r.name === newName && r.cat === newCat)) {
    editDishError.textContent = 'That dish already exists.';
    editDishName.focus();
    return;
  }

  const old = { name: dish.name, cat: dish.cat };
  const renamed = newName !== old.name;
  const moved = newCat !== old.cat;

  // if nothing changed, just close
  if (!renamed && !moved) {
    editDishDialog.close();
    return;
  }

  dish.name = newName;
  dish.cat = newCat;
  editDishDialog.close();
  render();

  let message;
  if (renamed && moved) message = `Renamed to "${newName}" and moved to ${newCat}`;
  else if (renamed) message = `Renamed "${old.name}" to "${newName}"`;
  else message = `Moved "${newName}" to ${newCat}`;

  showUndo(message, () => {
    dish.name = old.name;
    dish.cat = old.cat;
    render();
  });
}

// Checks / unchecks a dish. Unchecking (taking it off "this week") stamps
// cookedAt with the current time, which is what "recently cooked" uses.
function setDishChecked(id, checked) {
  const dish = findDish(id);
  dish.checked = checked;
  if (!checked) {
    dish.cookedAt = Date.now();
  }
  render();
}

// Removes a dish (only possible in Edit dishes mode) and offers Undo
function deleteDish(id) {
  const idx = data.dishes.findIndex(r => r.id === id);
  const removed = data.dishes.splice(idx, 1)[0];
  const entry = moveToTrash({ type: 'dish', dish: removed, idx });
  render();
  showUndo(`Deleted "${removed.name}"`, () => {
    restoreFromTrash(entry); // back in its old spot, recipe and all
    render();
  });
}

// Removes a cuisine AND every dish under it, and offers Undo
function deleteCuisine(cat) {
  const catIdx = data.categories.indexOf(cat);
  const removedDishes = data.dishes.map((d, i) => ({ d, i })).filter(x => x.d.cat === cat);
  const wasFilter = activeFilter === cat;

  // get rid of the cuisine and all dishes under it
  data.categories.splice(catIdx, 1);
  data.dishes = data.dishes.filter(r => r.cat !== cat);

  // set filter / dropdown back to default if they were on the deleted cuisine
  if (activeFilter === cat) activeFilter = 'All';
  if (selectedCat === cat) selectedCat = data.categories[0] || null;

  const entry = moveToTrash({ type: 'cuisine', cat, catIdx, dishes: removedDishes });
  render();

  const n = removedDishes.length;
  showUndo(`Deleted ${cat}` + (n ? ` and ${dishCount(n)}` : ''), () => {
    restoreFromTrash(entry);
    if (wasFilter) activeFilter = cat;
    render();
  });
}


/* ===========================================================================
   8. RENDER FUNCTIONS
   render() redraws every part of the screen from `data`, then saves.
   =========================================================================== */

function render() {
  renderTrashBtn();
  renderCatSelect();
  renderTabs();
  renderCatManageList();
  renderGroups();
  renderWeekList();
  renderRecentList();
  saveData();
}

// Fills the <select id="newCat"> dropdown with one <option> per cuisine
function renderCatSelect() {
  const sel = document.getElementById('newCat');

  // if selectedCat doesn't exist anymore, set it to the first cuisine (or null)
  if (!selectedCat || !data.categories.includes(selectedCat)) {
    selectedCat = data.categories[0] || null;
  }

  // put all cuisines in the dropdown
  sel.innerHTML = data.categories.map(c => `<option value="${c}">${c}</option>`).join('');

  // show the dropdown's currently-selected option to match selectedCat
  sel.value = selectedCat;
  // when the user manually picks a different option, update selectedCat to match
  sel.onchange = () => {
    selectedCat = sel.value;
  };
}

// Fills <div id="tabs"> with an "All" button plus one button per cuisine.
// Clicking a tab sets activeFilter and re-renders.
function renderTabs() {
  const container = document.getElementById('tabs');
  const cats = ['All', ...data.categories];

  container.innerHTML = cats.map(c => `
    <button class="tab ${c === activeFilter ? 'active' : ''}">${c}</button>
  `).join('');

  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.textContent;
      render();
    });
  });
}

// Builds the dish checklist, grouped by cuisine (filtered by the active tab)
function renderGroups() {
  const container = document.getElementById('groups');
  let allHTML = '';

  // which cuisines to show, based on the selected tab
  const catsToShow = activeFilter === 'All' ? data.categories : [activeFilter];

  for (const cat of catsToShow) {
    const dishesInCat = data.dishes.filter(r => r.cat === cat);
    allHTML += `<h2>${cat}</h2>`;
    if (dishesInCat.length === 0) {
      allHTML += `<p class="empty">no dishes yet</p>`;
    } else {
      // each row: checkbox + name, a "cooked" badge if any, then a recipe button.
      // In Edit dishes mode the checkbox becomes a pencil, the name becomes tappable,
      // and the recipe button becomes an x.
      allHTML += dishesInCat.map(r => `
        <div ${r.checked ? 'class="item checked"' : 'class="item"'}>
          ${editingDishes
            ? `<button class="dish-edit-btn" data-id="${r.id}" aria-label="Edit ${escapeHtml(r.name)}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
              </button>
              <button class="dish-name-btn" data-id="${r.id}">${escapeHtml(r.name)}</button>`
            : `<input type="checkbox" id="${r.id}" data-id="${r.id}" ${r.checked ? 'checked' : ''}/>
              <label for="${r.id}">${escapeHtml(r.name)}</label>`}
          ${r.cookedAt ? `<span class="recent-badge">${daysAgoText(r.cookedAt)}</span>` : ''}
          ${editingDishes
            ? `<button class="item-btn dish-del-btn" data-id="${r.id}" aria-label="Delete ${escapeHtml(r.name)}">&times;</button>`
            : `<button class="item-btn recipe-btn ${r.recipe ? 'has-recipe' : ''}" data-id="${r.id}" aria-label="Recipe for ${escapeHtml(r.name)}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 13h2M19 13h2"/><path d="M9 3.5c0 1.5 1.5 1.5 1.5 3M13.5 3.5c0 1.5 1.5 1.5 1.5 3"/></svg>
              </button>`}
        </div>
      `).join('');
    }
  }
  container.innerHTML = allHTML;

  // checkbox: checks/unchecks the dish
  container.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => setDishChecked(box.dataset.id, box.checked));
  });

  // "Edit dishes" button says "Done" and is highlighted while editing
  editDishesBtn.textContent = editingDishes ? 'Done' : 'Edit dishes';
  editDishesBtn.classList.toggle('on', editingDishes);

  // x button (only exists in edit mode)
  container.querySelectorAll('.dish-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteDish(btn.dataset.id));
  });

  // pencil and dish name (only exist in edit mode): open the edit window
  container.querySelectorAll('.dish-edit-btn, .dish-name-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditDish(btn.dataset.id));
  });

  // recipe button (only exists when NOT in edit mode)
  container.querySelectorAll('.recipe-btn').forEach(btn => {
    btn.addEventListener('click', () => openRecipe(btn.dataset.id));
  });
}

// Sidebar: "Cooking this week" (every dish with checked === true)
function renderWeekList() {
  const list = document.getElementById('weekList');
  const count = document.getElementById('weekCount');

  const weekList = data.dishes.filter(r => r.checked);

  count.innerHTML = weekList.length === 0 ? 'Nothing planned yet' :
    `${dishCount(weekList.length)} planned`;

  // each dish with its cuisine, and an x next to it
  list.innerHTML = weekList.map(w => `
    <div class="week-item">
      <label>${escapeHtml(w.name)}</label>
      <span class="tag">${escapeHtml(w.cat)}</span>
      <button class="del-btn" data-id="${w.id}">&times;</button>
    </div>
  `).join('');

  // x takes the dish off the list (same as unchecking it)
  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => setDishChecked(btn.dataset.id, false));
  });
}

// Sidebar: "Recently cooked" (every dish with a cookedAt time, newest first)
function renderRecentList() {
  const list = document.getElementById('recentList');
  const count = document.getElementById('recentCount');

  const recentList = data.dishes.filter(r => r.cookedAt !== null).sort((a, b) => b.cookedAt - a.cookedAt);

  count.innerHTML = recentList.length === 0 ? 'Nothing here yet' :
    `${dishCount(recentList.length)} cooked recently`;

  // each dish with its cuisine, when it was cooked, and an x next to it
  list.innerHTML = recentList.map(r => `
    <div class="recent-item">
      <label>${escapeHtml(r.name)}</label>
      <span class="meta">${escapeHtml(r.cat)} ·
      <span class="days">${daysAgoText(r.cookedAt)}</span></span>
      <button class="del-btn" data-id="${r.id}">&times;</button>
    </div>
  `).join('');

  // x clears the dish's cookedAt, removing it from this list
  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      findDish(btn.dataset.id).cookedAt = null;
      render();
    });
  });
}

// "Edit cuisines" panel: shown/hidden based on editingCatsOpen, and when
// shown, lists every cuisine with a delete button
function renderCatManageList() {
  const catsPanel = document.getElementById('editCatsPanel');
  const catList = document.getElementById('catManageList');

  catsPanel.classList.toggle('show', editingCatsOpen);

  // button says "Done" and is highlighted while the panel is open
  editCatsBtn.innerHTML = editingCatsOpen ? 'Done' : 'Edit cuisines';
  editCatsBtn.classList.toggle('on', editingCatsOpen);

  // the list only needs to be built when the panel is open
  if (editingCatsOpen) {
    catList.innerHTML = data.categories.map(c => `
      <div class="cat-manage-item">
        <label>${escapeHtml(c)}</label>
        <button class="del-btn" data-id="${c}">&times;</button>
      </div>
    `).join('');

    catList.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteCuisine(btn.dataset.id));
    });
  }
}


/* ===========================================================================
   9. RECIPE PAGE (rich text)
   The recipe is an editable div. It is saved as HTML on the dish
   (dish.recipe + dish.recipeFmt = 'html') and cleaned by sanitizeHtml()
   every time it is saved or loaded, so only bold, lists and headings survive.
   =========================================================================== */

// ---- cleaning + converting recipe text ----

// Keeps only bold, lists, headings, paragraphs; drops every attribute and everything else
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'); // inert: nothing in it runs
  const out = document.createElement('div');
  (function walk(from, to) {
    for (const node of from.childNodes) {
      if (node.nodeType === 3) {
        to.appendChild(document.createTextNode(node.textContent));
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        const mapped = TAG_MAP[tag] || tag;
        if (ALLOWED_TAGS.has(mapped)) {
          const el = document.createElement(mapped);
          to.appendChild(el);
          walk(node, el);
        } else {
          walk(node, to); // unknown tag: keep its contents, drop the tag
        }
      }
    }
  })(doc.body, out);
  return out.innerHTML;
}

// Old plain-text recipes ("- " bullets, "1. ", "# ", **bold**) -> html, once
function legacyToHtml(text) {
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '';
  let list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/^- (.*)/))) {
      if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\d+\. (.*)/))) {
      if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      if ((m = line.match(/^# (.*)/))) html += `<h3>${inline(m[1])}</h3>`;
      else if (line.trim() === '') html += '<p><br></p>';
      else html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

// ---- open / close / save ----

// Shows the placeholder when the editor has no text
function updateEmpty() {
  const empty = !recipeEditor.textContent.trim() && !recipeEditor.querySelector('li, h3');
  recipeEditor.classList.toggle('is-empty', empty);
}

// Writes the editor into the dish and saves
function saveRecipe() {
  clearTimeout(saveTimer);
  const dish = findDish(currentRecipeId);
  if (!dish) return;
  dish.recipe = recipeEditor.textContent.trim() ? sanitizeHtml(recipeEditor.innerHTML) : '';
  dish.recipeFmt = 'html';
  saveData();
}

// Saves 400ms after the last keystroke instead of on every one
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRecipe, 400);
}

// Edit mode = editable + toolbar, view mode = same text, locked
function setEditing(on) {
  recipeView.classList.toggle('editing', on);
  recipeEditBtn.textContent = on ? 'Done' : 'Edit';
  recipeEditor.contentEditable = on ? 'true' : 'false';
  recipeEditor.dataset.placeholder = on ? 'Ingredients, steps, notes...' : 'No recipe yet.';
  if (on) {
    recipeEditor.focus();
    const range = document.createRange();
    range.selectNodeContents(recipeEditor);
    range.collapse(false); // caret at the end
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    recipeEditor.blur();
    saveRecipe();
  }
}

// Keeps the screen from dimming/locking while a recipe is open (browsers that support it)
async function keepAwake(on) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    // not allowed right now (e.g. battery saver) - the recipe still works, the screen just may dim
  }
}

// Switches from the list to a dish's recipe
function openRecipe(id) {
  const dish = findDish(id);
  if (!dish) return;
  currentRecipeId = id;
  listScroll = window.scrollY;
  recipeTitle.textContent = dish.name;
  recipeTag.textContent = dish.cat;
  const html = !dish.recipe ? '' : (dish.recipeFmt === 'html' ? dish.recipe : legacyToHtml(dish.recipe));
  recipeEditor.innerHTML = sanitizeHtml(html);
  updateEmpty();
  listView.hidden = true;
  recipeView.hidden = false;
  window.scrollTo(0, 0);
  history.pushState({ recipe: id }, ''); // so the phone/browser back button returns to the list
  hideToast();
  keepAwake(true);
  setEditing(!dish.recipe);              // empty recipe opens straight into edit mode
}

// Runs for the back arrow, browser back button, and phone back swipe:
// save, leave edit mode, show the list again
function closeRecipe() {
  if (recipeView.hidden) return;
  saveRecipe();
  keepAwake(false);
  currentRecipeId = null;
  recipeView.classList.remove('editing');
  recipeEditor.contentEditable = 'false';
  recipeView.hidden = true;
  listView.hidden = false;
  render();
  window.scrollTo(0, listScroll);
}

// ---- toolbar + caret helpers (phones) ----

// If the caret is about to sit under the fixed bottom toolbar (phones), scroll it up above the toolbar
function keepCaretVisible() {
  if (getComputedStyle(recipeToolbar).position !== 'fixed') return;
  const sel = getSelection();
  if (!sel.rangeCount || !recipeEditor.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(false);
  let rect = range.getClientRects()[0];
  if (!rect || (rect.top === 0 && rect.bottom === 0)) {
    let n = range.startContainer;
    if (n.nodeType === 1 && n.childNodes.length) n = n.childNodes[Math.min(range.startOffset, n.childNodes.length - 1)];
    if (n.nodeType === 3) n = n.parentElement;
    rect = n.getBoundingClientRect();
  }
  const limit = recipeToolbar.getBoundingClientRect().top - 12;
  if (rect.bottom > limit) window.scrollBy(0, rect.bottom - limit);
}

// Keeps the toolbar pinned just above the on-screen keyboard (CSS reads --kb)
function placeToolbar() {
  const vv = window.visualViewport;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  recipeToolbar.style.setProperty('--kb', kb + 'px');
}

// Is the caret currently inside a heading?
const isHeading = () => /h3|heading 3/i.test(document.queryCommandValue('formatBlock'));

// Lights up the toolbar buttons that apply to where the caret is
function refreshToolbar() {
  const state = {
    bold: document.queryCommandState('bold'),
    bullet: document.queryCommandState('insertUnorderedList'),
    number: document.queryCommandState('insertOrderedList'),
    heading: isHeading()
  };
  recipeToolbar.querySelectorAll('button').forEach(b => b.classList.toggle('on', !!state[b.dataset.fmt]));
}


/* ===========================================================================
   10. BACKUP + RESTORE
   =========================================================================== */

// "Back up" button: share menu on phones/Macs, otherwise copy to clipboard
async function exportBackup() {
  const text = JSON.stringify(data);

  if (useShareMenu) {
    try {
      await navigator.share({ title: 'Cooking List backup', text: text });
    } catch (e) {
      // user closed the share menu, nothing to do
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    exportBtn.textContent = 'Copied!';
    setTimeout(() => { exportBtn.textContent = 'Back up'; }, 1500);
  } catch (e) {
    // clipboard blocked: show the text in the Restore dialog so it can be copied by hand
    restoreText.value = text;
    restoreError.textContent = 'Select and copy the text above.';
    restoreDialog.showModal();
  }
}

// Restore dialog's confirm button: replaces everything with the pasted backup
function confirmRestore() {
  try {
    const parsed = JSON.parse(restoreText.value.trim());
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.dishes)) throw new Error('bad format');
    data = parsed;
    cleanTrash();
    activeFilter = 'All';
    selectedCat = data.categories[0] || null;
    restoreDialog.close();
    render();
  } catch (e) {
    restoreError.textContent = "That doesn't look like a valid backup.";
  }
}


/* ===========================================================================
   11. THEME PICKER
   The chosen theme is saved on this device (it is not part of backups) and
   applied by setting data-theme on <html>; style.css does the actual coloring.
   index.html also applies it from <head> so the page never flashes the wrong colors.
   =========================================================================== */

// Reads the saved theme key; anything missing or unknown counts as 'auto'
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.some(t => t.key === saved)) return saved;
  } catch (e) {
    console.error('Theme load failed', e);
  }
  return 'auto';
}

// Puts a theme on the page ('auto' removes it so the device's light/dark setting is used)
function applyTheme(key) {
  if (key === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = key;
}

// Picks a theme: applies it, saves it, and moves the ring to it
function setTheme(key) {
  currentTheme = key;
  applyTheme(key);
  try {
    if (key === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, key);
  } catch (e) {
    console.error('Theme save failed', e);
  }
  renderThemeList();
}

// Fills the theme menu with one round swatch + name per theme
function renderThemeList() {
  const list = document.getElementById('themeList');
  list.innerHTML = THEMES.map(t => `
    <button type="button" class="theme-opt ${t.key === currentTheme ? 'selected' : ''}" data-key="${t.key}" aria-pressed="${t.key === currentTheme}">
      <span class="theme-swatch" style="--sw-a: ${t.a}; --sw-b: ${t.b}"></span>
      <span class="theme-name">${t.name}</span>
    </button>
  `).join('');

  list.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.key));
  });
}


/* ===========================================================================
   12. EVENT LISTENERS
   Everything is wired up once, here, when the page loads.
   =========================================================================== */

// ---- add a dish ----
addBtn.addEventListener('click', () => {
  addDish();
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addDish();
  }
});

// ---- edit buttons + cuisine editor ----

// opens/closes the "Edit cuisines" panel (clears the input when closing)
editCatsBtn.addEventListener('click', () => {
  editingCatsOpen = !editingCatsOpen;
  if (!editingCatsOpen) {
    catNameInput.value = '';
    catError.innerHTML = '';
  }
  render();
});

// turns "Edit dishes" mode on/off
editDishesBtn.addEventListener('click', () => {
  editingDishes = !editingDishes;
  render();
});

// adds a cuisine (Add button or Enter key)
addCatBtn.addEventListener('click', () => {
  addCuisine();
});
catNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addCuisine();
  }
});

// ---- edit dish window ----
document.getElementById('editDishSave').addEventListener('click', saveEditDish);
document.getElementById('editDishCancel').addEventListener('click', () => editDishDialog.close());
editDishName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEditDish();
});
// clear the error message as soon as something is changed
editDishName.addEventListener('input', () => { editDishError.textContent = ''; });
editDishCat.addEventListener('change', () => { editDishError.textContent = ''; });

// ---- collapse/expand the list (tap the title on phones) ----
listToggle.addEventListener('click', () => {
  listContent.classList.toggle('collapsed');
  listToggle.classList.toggle('collapsed');
});

// ---- undo toast ----
toastUndo.addEventListener('click', () => {
  if (undoAction) undoAction();
  hideToast();
});

// ---- recently deleted dialog ----
trashBtn.addEventListener('click', () => {
  cleanTrash();
  renderTrashList();
  trashDialog.showModal();
});
document.getElementById('trashClose').addEventListener('click', () => trashDialog.close());

// ---- theme dialog ----
themeBtn.addEventListener('click', () => {
  renderThemeList();
  themeDialog.showModal();
});
document.getElementById('themeClose').addEventListener('click', () => themeDialog.close());

// ---- backup + restore ----
exportBtn.addEventListener('click', exportBackup);

importBtn.addEventListener('click', () => {
  restoreText.value = '';
  restoreError.textContent = '';
  restoreDialog.showModal();
});

document.getElementById('restoreCancel').addEventListener('click', () => {
  restoreDialog.close();
});

document.getElementById('restoreConfirm').addEventListener('click', confirmRestore);

// ---- recipe page: navigation ----
document.getElementById('recipeBack').addEventListener('click', () => history.back());
recipeEditBtn.addEventListener('click', () => setEditing(!recipeView.classList.contains('editing')));

// back arrow, browser back button, and phone back swipe all end up here
window.addEventListener('popstate', closeRecipe);

document.addEventListener('visibilitychange', () => {
  if (!currentRecipeId) return;
  if (document.hidden) saveRecipe();
  else keepAwake(true); // the browser releases the screen lock when the tab is hidden, so take it again
});

// ---- recipe page: typing ----
recipeEditor.addEventListener('input', () => {
  updateEmpty();
  scheduleSave();
  keepCaretVisible();
});

// paste as plain text so nothing weird comes in from websites
recipeEditor.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Tab: indents a list item (nested list) or adds an indent at the caret; Shift+Tab removes it
recipeEditor.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const sel = getSelection();
  const node = sel.anchorNode;
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  if (el && el.closest('li')) {
    document.execCommand(e.shiftKey ? 'outdent' : 'indent');
  } else if (!e.shiftKey) {
    document.execCommand('insertText', false, '\t'); // one real tab character, so one Backspace removes it
  } else {
    const n = sel.anchorNode, off = sel.anchorOffset;
    if (n && n.nodeType === 3 && off > 0 && n.textContent[off - 1] === '\t') document.execCommand('delete');
  }
  updateEmpty();
  scheduleSave();
});

// ---- recipe page: formatting toolbar ----

// mousedown preventDefault keeps the keyboard open when a toolbar button is pressed
recipeToolbar.addEventListener('mousedown', (e) => e.preventDefault());

recipeToolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (document.activeElement !== recipeEditor) {
    recipeEditor.focus();
    if (savedRange) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }
  if (btn.dataset.fmt === 'heading') document.execCommand('formatBlock', false, isHeading() ? 'p' : 'h3');
  else document.execCommand(FORMAT_CMD[btn.dataset.fmt]);
  updateEmpty();
  scheduleSave();
  refreshToolbar(); // no selection change fires when bold is just switched on, so update the buttons now
});

// remembers the caret, lights up the toolbar buttons that apply, and keeps the caret above the toolbar
document.addEventListener('selectionchange', () => {
  if (!recipeView.classList.contains('editing') || !recipeEditor.contains(getSelection().anchorNode)) return;
  savedRange = getSelection().getRangeAt(0).cloneRange();
  refreshToolbar();
  keepCaretVisible();
});

// phones: when the keyboard opens/closes, re-check the caret (after the toolbar
// has moved) and keep the toolbar pinned just above the keyboard
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (recipeView.classList.contains('editing')) setTimeout(keepCaretVisible, 60);
  });
  window.visualViewport.addEventListener('resize', placeToolbar);
  window.visualViewport.addEventListener('scroll', placeToolbar);
}


/* ===========================================================================
   13. STARTUP
   =========================================================================== */

// Enter makes <p>, not <div>, inside the recipe editor
document.execCommand('defaultParagraphSeparator', false, 'p');

// Apply the saved color theme
applyTheme(currentTheme);

// Make sure data.trash exists and is pruned before the first draw
cleanTrash();

// Asks the browser to protect saved data from being cleared when space is low (it may or may not agree).
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// Draws the screen for the first time when the page loads.
render();