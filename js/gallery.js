// The gallery list comes from data/media.json. If that file can't be loaded,
// the original photos below stay visible.
const FALLBACK_PHOTOS = [
    { src: "images/cedar-park-venue.jpg", space: "venue", caption: "Cedar Park Venue from above", alt: "Cedar Park Venue from above", type: "image" },
    { src: "images/cedar-park.jpg", space: "venue", caption: "Cedar Park grounds and parking", alt: "Cedar Park grounds and parking", type: "image" },
    { src: "images/cedar-park-hall.jpg", space: "hall", caption: "Inside Cedar Park Hall", alt: "Inside Cedar Park Hall", type: "image" },
    { src: "images/venue.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue2.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue3.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue4.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue5.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue6.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue7.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue8.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    { src: "images/venue9.jpg", space: "venue", caption: "Cedar Park Venue", alt: "Cedar Park Venue", type: "image" },
    
];

(function () {
    const grid = document.getElementById("galGrid");
    const tabs = document.getElementById("galTabs");
    const empty = document.getElementById("galEmpty");
    const box = document.getElementById("lightbox");
    if (!grid || !tabs || !box) return;

    const lbImg = box.querySelector("img");
    const lbVideo = box.querySelector("video");
    const lbCount = box.querySelector(".lb-count");
    const queryGallery = new URLSearchParams(window.location.search).get("gallery");
    let filter = ["venue", "hall"].includes(queryGallery) ? queryGallery : "all";
    let allMedia = FALLBACK_PHOTOS;
    let shown = [];
    let pos = 0;
    let lastFocus = null;

    function mediaType(item) {
        return item.type || (String(item.src).match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? "video" : "image");
    }

    function mediaCaption(item) {
        return item.caption || item.alt || "Cedar Park gallery";
    }

    function render() {
        shown = allMedia.filter(item => filter === "all" || item.space === filter);
        grid.innerHTML = "";

        shown.forEach((item, i) => {
            const btn = document.createElement("button");
            btn.className = "gal-item";
            btn.setAttribute("aria-label", "Open " + mediaType(item) + ": " + mediaCaption(item));

            let media;
            if (mediaType(item) === "video") {
                media = document.createElement("video");
                media.preload = "metadata";
                media.muted = true;
                media.playsInline = true;
                media.setAttribute("aria-label", mediaCaption(item));
            } else {
                media = document.createElement("img");
                media.alt = mediaCaption(item);
                media.loading = "lazy";
                media.decoding = "async";
            }
            media.src = item.src;
            btn.appendChild(media);

            if (mediaType(item) === "video") {
                const play = document.createElement("span");
                play.className = "gal-video-badge";
                play.setAttribute("aria-hidden", "true");
                play.textContent = "▶ Video";
                btn.appendChild(play);
            }
            if (item.caption) {
                const caption = document.createElement("span");
                caption.className = "gal-caption";
                caption.textContent = item.caption;
                btn.appendChild(caption);
            }
            btn.addEventListener("click", () => openBox(i));
            grid.appendChild(btn);
        });

        empty.hidden = shown.length > 0;
        if (!shown.length) empty.textContent = "More photos and videos coming soon...";
    }

    function show() {
        const item = shown[pos];
        if (!item) return;
        const src = item.src;
        if (mediaType(item) === "video") {
            lbImg.hidden = true;
            lbVideo.hidden = false;
            lbVideo.src = src;
            lbVideo.load();
        } else {
            lbVideo.pause();
            lbVideo.removeAttribute("src");
            lbVideo.load();
            lbVideo.hidden = true;
            lbImg.hidden = false;
            lbImg.src = src;
            lbImg.alt = mediaCaption(item);
        }
        lbCount.textContent = (pos + 1) + " / " + shown.length;
    }

    function openBox(i) {
        lastFocus = document.activeElement;
        pos = i;
        show();
        box.hidden = false;
        document.body.style.overflow = "hidden";
        box.querySelector(".lb-close").focus();
    }

    function closeBox() {
        box.hidden = true;
        lbVideo.pause();
        lbVideo.removeAttribute("src");
        lbVideo.load();
        document.body.style.overflow = "";
        if (lastFocus) lastFocus.focus();
    }

    function step(dir) {
        if (!shown.length) return;
        pos = (pos + dir + shown.length) % shown.length;
        show();
    }

    tabs.addEventListener("click", e => {
        const button = e.target.closest("button");
        if (!button) return;
        filter = button.dataset.filter;
        tabs.querySelectorAll("button").forEach(tab => {
            const active = tab === button;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-pressed", String(active));
        });
        render();
    });

    box.querySelector(".lb-close").addEventListener("click", closeBox);
    box.querySelector(".lb-prev").addEventListener("click", () => step(-1));
    box.querySelector(".lb-next").addEventListener("click", () => step(1));
    box.addEventListener("click", e => { if (e.target === box) closeBox(); });

    document.addEventListener("keydown", e => {
        if (box.hidden) return;
        if (e.key === "Escape") closeBox();
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
    });

    let startX = 0;
    box.addEventListener("touchstart", e => { startX = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });

    tabs.querySelectorAll("button").forEach(tab => {
        const active = tab.dataset.filter === filter;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
    });

    render();
    fetch("data/media.json", { cache: "no-store" })
        .then(response => { if (!response.ok) throw new Error("Gallery list unavailable"); return response.json(); })
        .then(items => {
            if (Array.isArray(items)) {
                allMedia = items.map(item => ({ ...item, alt: item.caption || item.originalName || "Cedar Park gallery" }));
                render();
            }
        })
        .catch(() => { /* Keep the original static gallery as a fallback. */ });
})();
