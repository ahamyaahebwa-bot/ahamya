// Gallery page: loads the photos you upload in the dashboard and lays them out in columns
// so each one keeps its own shape. No library needed: it talks to Supabase directly.
(function () {
    const cfg = window.CEDAR_CONFIG || {};
    const colsEl = document.getElementById("gpCols");
    const stateEl = document.getElementById("gpState");
    const tabsEl = document.getElementById("gpTabs");
    if (!colsEl) return;

    const configured = cfg.supabaseUrl && cfg.supabaseAnonKey && !/^PASTE/.test(cfg.supabaseUrl);
    const fileUrl = (kind, id) => cfg.supabaseUrl + "/storage/v1/object/public/gallery/" + kind + "/" + id + ".jpg";

    let photos = [];       // everything from the database
    let shown = [];        // after the tab filter
    let filter = "all";
    let colCount = 0;

    function say(text) {
        stateEl.textContent = text;
        stateEl.hidden = !text;
    }

    // ----- how many columns for this screen width -----
    function columnsFor(width) {
        if (width < 520) return 2;
        if (width < 900) return 3;
        if (width < 1280) return 4;
        if (width < 1700) return 5;
        return 6;
    }

    // ----- place every photo into the shortest column (keeps the edges even) -----
    function render() {
        colCount = columnsFor(colsEl.clientWidth || window.innerWidth);
        colsEl.textContent = "";

        const cols = [];
        const heights = [];
        for (let i = 0; i < colCount; i++) {
            const col = document.createElement("div");
            col.className = "gp-col";
            colsEl.appendChild(col);
            cols.push(col);
            heights.push(0);
        }

        shown.forEach((p, index) => {
            const ratio = p.height / p.width;
            let target = 0;
            for (let i = 1; i < colCount; i++) if (heights[i] < heights[target] - 0.001) target = i;
            heights[target] += ratio;

            const tile = document.createElement("button");
            tile.type = "button";
            tile.className = "gp-item";
            tile.style.paddingBottom = (ratio * 100).toFixed(3) + "%";
            tile.setAttribute("aria-label", "Open photo " + (index + 1));

            const img = document.createElement("img");
            img.alt = "Cedar Park photo";
            img.decoding = "async";
            img.loading = index < colCount * 3 ? "eager" : "lazy";
            img.addEventListener("load", () => img.classList.add("loaded"));
            img.src = fileUrl("thumb", p.file_id);

            tile.appendChild(img);
            tile.addEventListener("click", () => openViewer(index));
            cols[target].appendChild(tile);
        });

        if (!photos.length) say("No photos yet. Check back soon.");
        else if (!shown.length) say("No photos in this group yet.");
        else say("");
    }

    function applyFilter() {
        shown = photos.filter(p => filter === "all" || p.space === filter);
        render();
    }

    tabsEl.addEventListener("click", e => {
        const btn = e.target.closest("button[data-filter]");
        if (!btn) return;
        filter = btn.dataset.filter;
        tabsEl.querySelectorAll("button").forEach(b => {
            const on = b === btn;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", String(on));
        });
        applyFilter();
    });

    // Re-flow only when the number of columns changes
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (columnsFor(colsEl.clientWidth || window.innerWidth) !== colCount) render();
        }, 150);
    });

    // ----- photo viewer -----
    const lb = document.getElementById("gpLb");
    const lbImg = document.getElementById("gpLbImg");
    const lbCount = document.getElementById("gpLbCount");
    let open = -1;
    let lastFocus = null;

    function showAt(i) {
        open = (i + shown.length) % shown.length;
        lbImg.src = fileUrl("full", shown[open].file_id);
        lbCount.textContent = (open + 1) + " / " + shown.length;
        // warm up the neighbours so arrows feel instant
        [open - 1, open + 1].forEach(n => {
            if (shown.length > 1) new Image().src = fileUrl("full", shown[(n + shown.length) % shown.length].file_id);
        });
    }

    function openViewer(i) {
        lastFocus = document.activeElement;
        lb.hidden = false;
        document.body.style.overflow = "hidden";
        showAt(i);
        lb.querySelector(".gp-lb-close").focus();
    }

    function closeViewer() {
        lb.hidden = true;
        lbImg.removeAttribute("src");
        document.body.style.overflow = "";
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    lb.querySelector(".gp-lb-close").addEventListener("click", closeViewer);
    lb.querySelector(".gp-lb-prev").addEventListener("click", () => showAt(open - 1));
    lb.querySelector(".gp-lb-next").addEventListener("click", () => showAt(open + 1));
    lb.addEventListener("click", e => { if (e.target === lb) closeViewer(); });
    document.addEventListener("keydown", e => {
        if (lb.hidden) return;
        if (e.key === "Escape") closeViewer();
        if (e.key === "ArrowLeft") showAt(open - 1);
        if (e.key === "ArrowRight") showAt(open + 1);
    });

    let touchX = 0;
    lb.addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) showAt(open + (dx < 0 ? 1 : -1));
    });

    // ----- load the photo list -----
    if (!configured) {
        say("The gallery isn't connected yet. Add your Supabase details in js/supabase-config.js.");
        return;
    }

    say("Loading photos...");
    fetch(cfg.supabaseUrl + "/rest/v1/photos?select=file_id,space,width,height&order=created_at.desc&limit=2000", {
        headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey }
    })
        .then(res => {
            if (!res.ok) throw new Error("bad response");
            return res.json();
        })
        .then(rows => {
            photos = rows.filter(r => r.width > 0 && r.height > 0);
            applyFilter();
        })
        .catch(() => say("We couldn't load the photos right now. Please try again in a moment."));
})();
