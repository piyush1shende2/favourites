// ============================================================
// PART 1: IMPORTS
// ============================================================

// useState = lets a component REMEMBER a value and redraw when it changes.
// useEffect = runs extra code AFTER the screen is drawn (saving data, listeners).
import { useState, useEffect } from "react";

// Loads the stylesheet so every className below gets its design.
import "./App.css";

// ============================================================
// PART 2: HELPERS AND STARTING DATA
// ============================================================

// uid = unique id maker. Math.random() gives e.g. 0.7381..., toString(36) turns it into
// letters and digits, slice(2, 9) drops the "0." and keeps 7 characters.
const uid = () => Math.random().toString(36).slice(2, 9);

// mk = "make item". Returns one favourite object: its own id, a name, an image path,
// rating 0 (not rated), an empty note, and fav false (not a favourite yet).
const mk = (name, image) => ({ id: uid(), name, image, rating: 0, note: "", fav: false });

// DEFAULT = the data used the very first time the app opens.
// An array of categories; each has an id, title, icon and an items list.
// [1, 2, 3].map(...) runs 3 times and builds 3 items, e.g. "Actor 1" with "/images/actor1.jpg".
const DEFAULT = [
  { id: "c1", title: "Favourite Actor", icon: "🎬", items: [1, 2, 3].map((n) => mk(`Actor ${n}`, `/images/actor${n}.jpg`)) },
  { id: "c2", title: "Favourite Actress", icon: "🌟", items: [1, 2, 3].map((n) => mk(`Actress ${n}`, `/images/actress${n}.jpg`)) },
  { id: "c3", title: "Favourite Cricketer", icon: "🏏", items: [1, 2, 3].map((n) => mk(`Cricketer ${n}`, `/images/cricketer${n}.jpg`)) },
];

// A flag so the "storage is full" warning appears only ONCE, not on every save.
let warned = false;

// ============================================================
// PART 3: useStored (works like useState but also saves in localStorage)
// ============================================================

// key = the name used in localStorage. initial = value to use if nothing is saved yet.
function useStored(key, initial) {
  // useState with a function runs that function ONCE, at the start, to get the first value.
  const [v, setV] = useState(() => {
    // try/catch: if anything inside fails, jump to catch instead of crashing the app.
    try {
      // Look in the browser's localStorage for text saved under this key.
      const s = localStorage.getItem(key);
      // If something was saved, turn the text back into data (JSON.parse); else use the start value.
      return s ? JSON.parse(s) : initial;
    } catch {
      // Saved data was broken or storage is blocked: fall back to the start value.
      return initial;
    }
  });
  // Runs every time key or v changes.
  useEffect(() => {
    // wait 300ms after the last change so typing stays smooth (setTimeout = run later)
    const t = setTimeout(() => {
      try {
        // localStorage only keeps TEXT, so JSON.stringify turns the data into text.
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // Saving failed (normally because the ~5 MB storage is full).
        if (!warned) {
          warned = true; // remember that we already warned
          alert("Browser storage is full. Remove a few photos or use smaller images.");
        }
      }
    }, 300);
    // Cleanup: if v changes again before 300ms pass, cancel the old timer ("debouncing").
    return () => clearTimeout(t);
  }, [key, v]); // run this effect again only when key or v changes
  // Give back the value and its setter, exactly like useState does.
  return [v, setV];
}

// ============================================================
// PART 4: Stars COMPONENT (5 clickable stars)
// ============================================================

// A component is a function that returns UI. value = current rating (0-5).
// onChange = the function to call when a star is clicked. These inputs are called props.
function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {/* [1,2,3,4,5].map makes one button for each number n */}
      {[1, 2, 3, 4, 5].map((n) => (
        // key = React's name tag for list items.
        // className "on" lights the star when n is at or below the rating.
        // onClick: clicking the SAME star again (n === value) resets to 0, else sets n.
        // aria-label = text read aloud by screen readers.
        <button key={n} className={n <= value ? "on" : ""} onClick={() => onChange(n === value ? 0 : n)} aria-label={`${n} stars`}>★</button>
      ))}
    </div>
  );
}

// ============================================================
// PART 5: MAIN App COMPONENT
// ============================================================

// "export default" lets main.jsx import this component as the app.
export default function App() {
  // ---------- STATE (the app's memory) ----------

  // All categories with their items. Saved under "fav-cats".
  const [cats, setCats] = useStored("fav-cats", DEFAULT);
  // true/false for dark mode. Saved.
  const [dark, setDark] = useStored("fav-dark", false);
  // Ids of recently viewed items. Saved.
  const [recent, setRecent] = useStored("fav-recent", []);
  // Id of the option currently shown in the photo panel. Saved.
  const [sel, setSel] = useStored("fav-sel", null);
  // Id of the category chosen in the FIRST dropdown ("" = nothing chosen). Saved.
  const [catId, setCatId] = useStored("fav-cat", "");
  // Text typed in the search box. Not saved (resets on refresh).
  const [q, setQ] = useState("");
  // Current sort choice: "manual", "name" or "rating".
  const [sort, setSort] = useState("manual");
  // Controls the popup window. null = closed; otherwise an object describing the form.
  const [modal, setModal] = useState(null);
  // true while a file is dragged over the photo panel (shows the dashed outline).
  const [over, setOver] = useState(false);

  // When dark changes, write "dark" or "light" on the <html> tag. The CSS reads it
  // (:root[data-theme="dark"]) and switches colours.
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  // ---------- DERIVED DATA (calculated from state, not stored) ----------

  // flatMap loops through every category and merges all items into ONE flat list.
  // Each item is copied ({ ...i }) and given the category title as "cat".
  const all = cats.flatMap((c) => c.items.map((i) => ({ ...i, cat: c.title })));
  // The item whose id equals the selected id (undefined if none).
  const current = all.find((x) => x.id === sel);
  // The full category object for the chosen id (undefined if none chosen or it was deleted).
  const cat = cats.find((c) => c.id === catId);
  // Only items marked as favourite.
  const favs = all.filter((x) => x.fav);
  // Only items with a rating above 0.
  const rated = all.filter((x) => x.rating > 0);
  // Average rating: add all ratings (reduce), divide by the count, keep 1 decimal (toFixed).
  // If nothing is rated yet, show a dash.
  const avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length).toFixed(1) : "–";

  // ---------- ACTIONS (functions that change state) ----------

  // pick = the user chose an option somewhere in the app.
  const pick = (id) => {
    setSel(id); // show this item in the photo panel
    // Find the category that CONTAINS this item (some = true if any item matches the id)...
    const owner = cats.find((c) => c.items.some((i) => i.id === id));
    // ...and open it in the first dropdown, so both dropdowns match the photo
    // (important when an item is clicked from "Recently viewed" or "Top rated").
    if (owner) setCatId(owner.id);
    // Add to the front of "recent", remove duplicates, keep only the latest 5.
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 5));
  };

  // patch = change some fields of ONE item. p holds the changes, e.g. { rating: 4 }.
  // Loops all categories, then all items; for the matching id it makes a copy with the changes
  // applied ({ ...i, ...p }); other items stay the same. State is never edited directly:
  // React needs a NEW copy to notice the change.
  const patch = (id, p) => setCats((cs) => cs.map((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })));

  // delItem = remove one option.
  const delItem = (id) => {
    // confirm() shows OK / Cancel. The ! means "if NOT OK": stop and delete nothing.
    if (!confirm("Remove this favourite?")) return;
    // Keep every item EXCEPT the one with this id.
    setCats((cs) => cs.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) })));
    // If the deleted item was on display, clear the photo panel.
    if (sel === id) setSel(null);
  };

  // delCat = remove a whole category.
  const delCat = (c) => {
    // Ask first; Cancel means stop.
    if (!confirm(`Delete "${c.title}" and all its options?`)) return;
    // Keep every category except this one.
    setCats((cs) => cs.filter((x) => x.id !== c.id));
    // If it was the open category, reset the first dropdown and clear the photo.
    if (catId === c.id) { setCatId(""); setSel(null); }
  };

  // save = runs when Save is pressed in the popup. 4 cases: edit/new category, edit/new option.
  const save = () => {
    const m = modal; // short name for the popup's data
    if (m.type === "cat") {
      // Category form: do nothing if the title is empty (trim removes spaces).
      if (!m.title.trim()) return;
      // Popup has an id = EDITING: update that category's title and icon.
      if (m.id) setCats((cs) => cs.map((c) => (c.id === m.id ? { ...c, title: m.title, icon: m.icon } : c)));
      else {
        // No id = ADDING a new category.
        const id = uid(); // make the id first so it can be used twice
        // Append the new category (empty items list; icon falls back to ⭐ if left blank).
        setCats((cs) => [...cs, { id, title: m.title, icon: m.icon || "⭐", items: [] }]);
        setCatId(id); // open it in the first dropdown straight away
        setSel(null); // clear the photo (the new category has no options yet)
      }
    } else {
      // Option form: do nothing if the name is empty.
      if (!m.name.trim()) return;
      // Has an id = EDITING: change its name and image.
      if (m.id) patch(m.id, { name: m.name, image: m.image });
      else {
        // No id = ADDING a new option.
        const it = mk(m.name, m.image); // build the item object
        // Add it to the category whose id equals m.catId (the one open when + Add was pressed).
        setCats((cs) => cs.map((c) => (c.id === m.catId ? { ...c, items: [...c.items, it] } : c)));
        pick(it.id); // select it immediately: photo panel and dropdown both show it
      }
    }
    // Close the popup.
    setModal(null);
  };

  // readFile = takes an image file, shrinks it, returns it as text (a "data URL").
  // Shrinking matters because localStorage holds only about 5 MB.
  const readFile = (file, done) => {
    const r = new FileReader(); // the browser tool that reads files
    r.onload = () => { // runs when the file has been read
      const img = new Image(); // an in-memory picture
      img.onload = () => { // runs when the picture has loaded
        // scale = how much to shrink so the longest side is at most 800px.
        // Math.min(1, ...) means a small image is never enlarged.
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); // an invisible drawing board
        c.width = Math.round(img.width * scale);    // new width
        c.height = Math.round(img.height * scale);  // new height
        const ctx = c.getContext("2d"); // the "pen" for drawing on the canvas
        ctx.fillStyle = "#fff";                       // paint white first so transparent
        ctx.fillRect(0, 0, c.width, c.height);        // PNGs do not turn black
        ctx.drawImage(img, 0, 0, c.width, c.height);  // draw the shrunken picture
        // Convert to a JPEG at 80% quality, as text, and hand it back.
        done(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => alert("Could not read that image."); // not a valid image
      img.src = r.result; // start loading the picture from the file's text
    };
    r.readAsDataURL(file); // begin reading the file as text
  };

  // Runs once when the app opens ([] at the end = only once).
  // A file dropped OUTSIDE the photo panel would normally make the browser open it and leave
  // your app. preventDefault() cancels that behaviour.
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    // Cleanup: remove the listeners when the component goes away.
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  // setImage = replace the photo of the option on display with a chosen file.
  const setImage = (file) => {
    // Nothing selected: tell the user and stop (return exits the function).
    if (!current) return alert("Pick a favourite first, then add the image.");
    // No file, or its type does not start with "image/": stop.
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image file.");
    // Shrink the file, then save it into that item's image field.
    readFile(file, (data) => patch(current.id, { image: data }));
  };

  // exportJson = download all data as a file.
  const exportJson = () => {
    const a = document.createElement("a"); // an invisible download link
    // Blob = file contents in memory. JSON.stringify(cats, null, 2) = readable text.
    // createObjectURL gives that file a temporary address.
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cats, null, 2)], { type: "application/json" }));
    a.download = "my-favourites.json"; // file name to save as
    a.click(); // "click" the link, which starts the download
  };

  // importJson = read a previously exported file and load it.
  const importJson = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result); // text -> data
        // Check it looks right: a list where every category has a title and an items list.
        if (Array.isArray(d) && d.every((c) => c.title && Array.isArray(c.items))) setCats(d);
        else alert("This file is not a valid favourites export.");
      } catch { alert("Could not read that file."); } // the text was not valid JSON
    };
    r.readAsText(file); // read the file as plain text
  };

  // shown = which options of a category to display, after search and sort.
  const shown = (c) => {
    // Keep options whose name contains the search text (both lowercased so capitals do not matter).
    // An empty search matches everything.
    let items = c.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
    // [...items] copies the list first, because sort() would change the original.
    // localeCompare sorts text A to Z. For rating, b - a puts higher ratings first.
    if (sort === "name") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "rating") items = [...items].sort((a, b) => b.rating - a.rating);
    return items;
  };

  // MiniList = a small reusable box (title + list of names), used 3 times near the bottom.
  const MiniList = ({ title, list }) => (
    <div className="mini">
      <h4>{title}</h4>
      {/* If the list is empty, show a friendly message */}
      {list.length === 0 && <p className="muted">Nothing here yet.</p>}
      {/* One button per item; clicking it calls pick, which shows it in the photo panel */}
      {list.map((x) => (
        <button key={x.id} onClick={() => pick(x.id)}>{x.name} <small>{x.cat}</small></button>
      ))}
    </div>
  );

  // ============================================================
  // PART 6: WHAT APPEARS ON SCREEN (JSX)
  // ============================================================
  return (
    <div className="page">
      {/* ---------- TOP BAR ---------- */}
      <header className="top">
        <h1>My Favourites</h1>

        {/* Controlled input: value comes from state q, and onChange updates q on every keystroke,
            so the option list re-filters instantly. */}
        <input className="search" placeholder="Search favourites…" value={q} onChange={(e) => setQ(e.target.value)} />

        {/* Sort primary dropdown: changes the sort state */}
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="manual">Sort: added order</option>
          <option value="name">Sort: A–Z</option>
          <option value="rating">Sort: top rated</option>
        </select>

        {/* !dark flips true/false. The label shows the mode you can switch TO. */}
        <button className="ghost" onClick={() => setDark(!dark)}>{dark ? "☀️ Light" : "🌙 Dark"}</button>
        <button className="ghost" onClick={exportJson}>Export</button>

        {/* The real file input is hidden; the styled label works as its button.
            e.target.files[0] && importJson(...) means "if a file was chosen, import it". */}
        <label className="ghost">Import<input type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && importJson(e.target.files[0])} /></label>
      </header>

      {/* ---------- STATS ROW (numbers come from the derived data above) ---------- */}
      <section className="stats">
        <div><b>{all.length}</b> items</div>
        <div><b>{cats.length}</b> categories</div>
        <div><b>{favs.length}</b> favourites</div>
        <div><b>{avg}</b> average rating</div>
      </section>

      {/* ---------- THE TWO LINKED DROPDOWNS ---------- */}
      <section className="picker">
        {/* BOX 1: main category dropdown */}
        <div className="pick-box">
          <span className="pick-label">1 · Main category</span>
          <div className="pick-row">
            {/* value={catId}: always shows the chosen category (controlled input).
                onChange: e.target.value is the id the user picked. Save it, and clear the
                photo (setSel(null)) because a different category was chosen. */}
            <select value={catId} onChange={(e) => { setCatId(e.target.value); setSel(null); }}>
              {/* Placeholder option: its value "" matches catId when nothing is chosen */}
              <option value="">Select a category…</option>
              {/* One <option> per category: value = id, text = icon + title */}
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.title}</option>)}
            </select>
            {/* ADD CATEGORY: opens the popup in "new category" mode (no id = adding) */}
            <button className="pill" onClick={() => setModal({ type: "cat", title: "", icon: "🚗" })}>+ Add</button>
            {/* cat && (...) = draw the buttons only if a category is chosen.
                <> </> is a fragment: groups elements without an extra wrapper. */}
            {cat && (
              <>
                {/* EDIT CATEGORY: popup pre-filled with this category's id, title and icon */}
                <button className="tiny" title="Edit category" onClick={() => setModal({ type: "cat", id: cat.id, title: cat.title, icon: cat.icon })}>✏️</button>
                {/* DELETE CATEGORY: calls delCat, which asks for confirmation */}
                <button className="tiny" title="Delete category" onClick={() => delCat(cat)}>🗑️</button>
              </>
            )}
          </div>
        </div>

        {/* BOX 2: appears only after a category is chosen.
            key={cat.id} rebuilds this box for each category, replaying the fade-in animation. */}
        {cat && (
          <div className="pick-box" key={cat.id}>
            <span className="pick-label">2 · {cat.icon} {cat.title}</span>
            <div className="pick-row">
              {/* value: if the selected item is in this list, show it; otherwise show the placeholder.
                  onChange: a real option chosen -> pick it; the placeholder chosen -> clear the photo. */}
              <select value={shown(cat).some((i) => i.id === sel) ? sel : ""} onChange={(e) => (e.target.value ? pick(e.target.value) : setSel(null))}>
                <option value="">Select an option…</option>
                {/* One <option> per option, with ❤️ if favourite and ★ repeated rating times */}
                {shown(cat).map((i) => (
                  <option key={i.id} value={i.id}>{i.fav ? "❤️ " : ""}{i.name}{i.rating > 0 ? "  " + "★".repeat(i.rating) : ""}</option>
                ))}
              </select>
              {/* ADD OPTION: popup in "new option" mode; catId says which category it goes into */}
              <button className="pill" onClick={() => setModal({ type: "item", catId: cat.id, name: "", image: "" })}>+ Add</button>
              {/* Show these buttons only if an option is selected AND it belongs to this category */}
              {current && cat.items.some((i) => i.id === sel) && (
                <>
                  {/* Heart flips fav true/false for the selected option */}
                  <button className="tiny" title="Favourite" onClick={() => patch(sel, { fav: !current.fav })}>{current.fav ? "❤️" : "🤍"}</button>
                  {/* Edit: popup pre-filled with the option's id, name and image */}
                  <button className="tiny" title="Edit option" onClick={() => setModal({ type: "item", id: sel, name: current.name, image: current.image })}>✏️</button>
                  {/* Delete: asks for confirmation, then removes the option */}
                  <button className="tiny" title="Remove option" onClick={() => delItem(sel)}>🗑️</button>
                </>
              )}
            </div>
            {/* Friendly hint when the category has no options yet */}
            {cat.items.length === 0 && <p className="muted">No options yet. Press + Add to create one.</p>}
          </div>
        )}
      </section>

      {/* ---------- BIG PHOTO PANEL (also the drag-and-drop zone) ----------
          className adds "over" while a file hovers (dashed outline).
          onDragOver: preventDefault is REQUIRED, otherwise the browser refuses drops here.
          onDragLeave: the file left the panel, so remove the outline.
          onDrop: the user released the file. */}
      <section
        className={`stage ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();                   // do not let the browser open the file
          setOver(false);                       // remove the outline
          const file = e.dataTransfer.files[0]; // the first dropped file (if any)
          if (file) setImage(file);             // a real file: replace the photo
          else alert("Drop an image file from your computer. Images dragged from websites can't be saved, so download them first.");
        }}
      >
        {/* current ? (show details) : (show the empty message) */}
        {current ? (
          // key={current.id} rebuilds this block for each new item, replaying the fade-in animation
          <div className="detail" key={current.id}>
            {/* onError: if the image path is wrong, fade the broken image */}
            <img src={current.image} alt={current.name} onError={(e) => (e.target.style.opacity = 0.2)} />
            <div className="info">
              <p className="muted">{current.cat}</p>
              <h2>{current.name}</h2>
              {/* Our Stars component: clicking a star calls patch to save the rating */}
              <Stars value={current.rating} onChange={(n) => patch(current.id, { rating: n })} />
              <button className="pill" onClick={() => patch(current.id, { fav: !current.fav })}>{current.fav ? "❤️ In favourites" : "🤍 Add to favourites"}</button>
              {/* Hidden file input + styled label = custom upload button.
                  e.target.value = "" afterwards lets you choose the SAME file again later. */}
              <label className="pill upload">
                📤 Upload new photo
                <input type="file" accept="image/*" hidden onChange={(e) => { setImage(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <p className="muted">You can also drag an image onto this card.</p>
              {/* The note saves into the item on every keystroke (storage saves after 300ms) */}
              <textarea placeholder="Write a personal note…" value={current.note} onChange={(e) => patch(current.id, { note: e.target.value })} />
            </div>
          </div>
        ) : (
          <div className="placeholder"><span>📷</span><p>Choose a favourite to see its photo</p></div>
        )}
      </section>

      {/* ---------- THREE MINI LISTS ---------- */}
      <section className="minis">
        <MiniList title="❤️ My favourites" list={favs} />
        {/* recent holds ids, so each id becomes the full item; filter(Boolean) drops ids whose item was deleted */}
        <MiniList title="🕐 Recently viewed" list={recent.map((id) => all.find((x) => x.id === id)).filter(Boolean)} />
        {/* Copy the rated items, sort highest first, keep the top 5 */}
        <MiniList title="⭐ Top rated" list={[...rated].sort((a, b) => b.rating - a.rating).slice(0, 5)} />
      </section>

      {/* ---------- POPUP WINDOW (drawn only when modal is not null) ---------- */}
      {modal && (
        // onMouseDown on the dark background: close ONLY if the press started on the background
        // itself (e.target === e.currentTarget), not on the form inside.
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          {/* onKeyDown: Escape closes the popup; Enter saves (but not inside the file input) */}
          <div
            className="modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(null);
              if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "file") save();
            }}
          >
            {/* Heading depends on what we are doing: edit/new category, edit/add favourite */}
            <h3>{modal.type === "cat" ? (modal.id ? "Edit category" : "New category") : modal.id ? "Edit favourite" : "Add favourite"}</h3>
            {/* Category form OR option form */}
            {modal.type === "cat" ? (
              <>
                {/* Controlled inputs: they show modal.icon / modal.title and update the modal object on every keystroke */}
                <label>Icon (any emoji)<input value={modal.icon} onChange={(e) => setModal({ ...modal, icon: e.target.value })} /></label>
                <label>Title<input autoFocus value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="Favourite Cars" /></label>
              </>
            ) : (
              <>
                <label>Name<input autoFocus value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></label>
                {/* If the image is an uploaded one (starts with "data:") show an empty box with a hint,
                    so the user cannot break it by typing over it */}
                <label>Image link or path<input value={modal.image.startsWith("data:") ? "" : modal.image} onChange={(e) => setModal({ ...modal, image: e.target.value })} placeholder={modal.image.startsWith("data:") ? "Using an uploaded photo" : "/images/photo.jpg"} /></label>
                {/* Upload inside the popup: shrink the file, then store it in modal.image.
                    setModal((m) => ...) uses the latest popup data safely. */}
                <label>…or upload<input type="file" accept="image/*" onChange={(e) => e.target.files[0] && readFile(e.target.files[0], (d) => setModal((m) => ({ ...m, image: d })))} /></label>
              </>
            )}
            {/* Cancel closes the popup; Save runs save() */}
            <div className="row">
              <button className="ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="pill" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <section id="center">
//         <div className="hero">
//           <img src={heroImg} className="base" width="170" height="179" alt="" />
//           <img src={reactLogo} className="framework" alt="React logo" />
//           <img src={viteLogo} className="vite" alt="Vite logo" />
//         </div>
//         <div>
//           <h1>Get started</h1>
//           <p>
//             Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
//           </p>
//         </div>
//         <button
//           type="button"
//           className="counter"
//           onClick={() => setCount((count) => count + 1)}
//         >
//           Count is {count}
//         </button>
//       </section>

//       <div className="ticks"></div>

//       <section id="next-steps">
//         <div id="docs">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#documentation-icon"></use>
//           </svg>
//           <h2>Documentation</h2>
//           <p>Your questions, answered</p>
//           <ul>
//             <li>
//               <a href="https://vite.dev/" target="_blank">
//                 <img className="logo" src={viteLogo} alt="" />
//                 Explore Vite
//               </a>
//             </li>
//             <li>
//               <a href="https://react.dev/" target="_blank">
//                 <img className="button-icon" src={reactLogo} alt="" />
//                 Learn more
//               </a>
//             </li>
//           </ul>
//         </div>
//         <div id="social">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#social-icon"></use>
//           </svg>
//           <h2>Connect with us</h2>
//           <p>Join the Vite community</p>
//           <ul>
//             <li>
//               <a href="https://github.com/vitejs/vite" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#github-icon"></use>
//                 </svg>
//                 GitHub
//               </a>
//             </li>
//             <li>
//               <a href="https://chat.vite.dev/" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#discord-icon"></use>
//                 </svg>
//                 Discord
//               </a>
//             </li>
//             <li>
//               <a href="https://x.com/vite_js" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#x-icon"></use>
//                 </svg>
//                 X.com
//               </a>
//             </li>
//             <li>
//               <a href="https://bsky.app/profile/vite.dev" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#bluesky-icon"></use>
//                 </svg>
//                 Bluesky
//               </a>
//             </li>
//           </ul>
//         </div>
//       </section>

//       <div className="ticks"></div>
//       <section id="spacer"></section>
//     </>
//   )
// }

// export default App
