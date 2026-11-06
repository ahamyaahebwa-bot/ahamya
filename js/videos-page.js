// Videos page: lays out the videos listed in js/videos-data.js in columns, each tile keeping
// its own shape (landscape or portrait, worked out automatically), and plays them in a viewer.
(function () {
    const list = (Array.isArray(window.CEDAR_VIDEOS) ? window.CEDAR_VIDEOS : []).filter(v => v && v.src);
    const colsEl = document.getElementById("vpCols");
    const stateEl = document.getElementById("vpState");
    if (!colsEl) return;

    let ratios = [];       // width / height of each video
    let colCount = 0;

    function say(text) {
        stateEl.textContent = text;
        stateEl.hidden = !text;
    }

    // "16:9", "9:16", "1:1" or a plain number -> width / height (0 if not usable)
    function parseRatio(r) {
        if (typeof r === "number" && r > 0) return r;
        const m = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/.exec(String(r || "").trim());
        return m ? Number(m[1]) / Number(m[2]) : 0;
    }

    // Finds a video's shape by reading its details (not the whole file).
    function detect(v) {
        const manual = parseRatio(v.ratio);
        if (manual) return Promise.resolve(manual);
        if (v.poster && !v.detectFromVideo) {
            // A cover picture shows the same shape, and loads much faster than the video.
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 16 / 9);
                img.onerror = () => resolve(16 / 9);
                img.src = v.poster;
            });
        }
        return new Promise(resolve => {
            const el = document.createElement("video");
            let done = false;
            const finish = r => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                el.removeAttribute("src");
                el.load();
                resolve(r);
            };
            const timer = setTimeout(() => finish(16 / 9), 6000);
            el.preload = "metadata";
            el.muted = true;
            el.addEventListener("loadedmetadata", () =>
                finish(el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : 16 / 9));
            el.addEventListener("error", () => finish(16 / 9));
            el.src = v.src;
        });
    }

    // ----- columns for this screen width -----
    function columnsFor(width) {
        const mostlyPortrait = ratios.filter(r => r < 1).length >= ratios.length / 2;
        let n;
        if (width < 560) n = mostlyPortrait ? 2 : 1;
        else if (width < 1000) n = 2;
        else n = 3;
        return Math.max(1, Math.min(n, list.length));
    }

    const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

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

        list.forEach((v, index) => {
            const hOverW = 1 / ratios[index];
            let target = 0;
            for (let i = 1; i < colCount; i++) if (heights[i] < heights[target] - 0.001) target = i;
            heights[target] += hOverW;

            const tile = document.createElement("button");
            tile.type = "button";
            tile.className = "gp-item vp-item";
            tile.style.paddingBottom = (hOverW * 100).toFixed(3) + "%";
            tile.setAttribute("aria-label", "Play video" + (v.title ? ": " + v.title : " " + (index + 1)));

            if (v.poster) {
                const img = document.createElement("img");
                img.alt = "";
                img.loading = "lazy";
                img.src = v.poster;
                tile.appendChild(img);
            } else {
                const vid = document.createElement("video");
                vid.muted = true;
                vid.playsInline = true;
                vid.preload = "metadata";
                vid.tabIndex = -1;
                vid.setAttribute("aria-hidden", "true");
                vid.src = v.src + "#t=0.1";      // shows the first moment as the cover
                tile.appendChild(vid);
            }

            const play = document.createElement("span");
            play.className = "vp-play";
            play.innerHTML = PLAY;
            tile.appendChild(play);

            if (v.title) {
                const t = document.createElement("span");
                t.className = "vp-title";
                t.textContent = v.title;
                tile.appendChild(t);
            }

            tile.addEventListener("click", () => openViewer(index));
            cols[target].appendChild(tile);
        });
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (ratios.length && columnsFor(colsEl.clientWidth || window.innerWidth) !== colCount) render();
        }, 150);
    });

    // ----- player -----
    const lb = document.getElementById("vpLb");
    const player = document.getElementById("vpPlayer");
    const lbCount = document.getElementById("vpCount");
    const lbTitle = document.getElementById("vpTitle");
    let open = -1;
    let lastFocus = null;

    function showAt(i) {
        open = (i + list.length) % list.length;
        const v = list[open];
        player.poster = v.poster || "";
        player.src = v.src;
        lbTitle.textContent = v.title || "";
        lbCount.textContent = list.length > 1 ? (open + 1) + " / " + list.length : "";
        const p = player.play();
        if (p && p.catch) p.catch(() => { /* the viewer's play button is still there */ });
    }

    function openViewer(i) {
        lastFocus = document.activeElement;
        lb.hidden = false;
        document.body.style.overflow = "hidden";
        showAt(i);
        lb.querySelector(".gp-lb-close").focus();
    }

    function closeViewer() {
        player.pause();
        player.removeAttribute("src");
        player.load();
        lb.hidden = true;
        document.body.style.overflow = "";
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    lb.querySelector(".gp-lb-close").addEventListener("click", closeViewer);
    const prev = lb.querySelector(".gp-lb-prev");
    const next = lb.querySelector(".gp-lb-next");
    prev.addEventListener("click", () => showAt(open - 1));
    next.addEventListener("click", () => showAt(open + 1));
    if (list.length < 2) { prev.hidden = true; next.hidden = true; }
    lb.addEventListener("click", e => { if (e.target === lb) closeViewer(); });
    document.addEventListener("keydown", e => {
        if (lb.hidden) return;
        if (e.key === "Escape") closeViewer();
        if (e.key === "ArrowLeft" && list.length > 1) showAt(open - 1);
        if (e.key === "ArrowRight" && list.length > 1) showAt(open + 1);
    });

    // ----- start -----
    if (!list.length) {
        say("No videos yet. Check back soon.");
        return;
    }

    say("Loading videos...");
    Promise.all(list.map(detect)).then(found => {
        ratios = found;
        say("");
        render();
    });
})();
