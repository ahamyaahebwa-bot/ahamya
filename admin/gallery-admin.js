// Dashboard > Gallery: upload photos (resized in your browser first), see them, delete them.
(function () {
    const C = window.CEDAR;
    const $ = id => document.getElementById(id);
    if (!C || !$("dropzone")) return;

    const FULL_EDGE = 2000;    // longest side of the photo shown full screen
    const THUMB_EDGE = 640;    // longest side of the small version used in the grid
    const publicUrl = (kind, id) => C.cfg.supabaseUrl + "/storage/v1/object/public/gallery/" + kind + "/" + id + ".jpg";

    let sb;
    let photos = [];
    let filter = "all";
    let space = "venue";

    // ----- image helpers -----
    async function readImage(file) {
        if (window.createImageBitmap) {
            try {
                const bmp = await createImageBitmap(file);
                return { source: bmp, width: bmp.width, height: bmp.height };
            } catch (e) { /* fall back below */ }
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight }); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
            img.src = url;
        });
    }

    function toJpeg(src, maxEdge, quality) {
        const scale = Math.min(1, maxEdge / Math.max(src.width, src.height));
        const w = Math.max(1, Math.round(src.width * scale));
        const h = Math.max(1, Math.round(src.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";                       // PNGs with see-through areas
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(src.source, 0, 0, w, h);
        return new Promise((resolve, reject) =>
            canvas.toBlob(b => (b ? resolve({ blob: b, width: w, height: h }) : reject(new Error("encode failed"))), "image/jpeg", quality));
    }

    // ----- upload queue -----
    const queueEl = $("queue");
    const waiting = [];
    let running = 0;

    function addToQueue(files) {
        Array.from(files).forEach(file => {
            if (!/^image\//.test(file.type)) {
                C.toast(file.name + " isn't a photo, skipped.", "error");
                return;
            }
            const li = document.createElement("li");
            li.innerHTML =
                '<img alt=""><div class="q-info"><div class="q-name"></div><div class="q-bar"><i></i></div></div><span class="q-status">Waiting</span>';
            li.querySelector(".q-name").textContent = file.name;
            queueEl.prepend(li);
            waiting.push({ file: file, li: li, space: space });
        });
        pump();
    }

    function pump() {
        while (running < 2 && waiting.length) {
            const job = waiting.shift();
            running++;
            uploadOne(job).finally(() => { running--; pump(); });
        }
    }

    async function uploadOne(job) {
        const status = job.li.querySelector(".q-status");
        const bar = job.li.querySelector(".q-bar i");
        const thumbImg = job.li.querySelector("img");
        const set = (text, cls, pct) => {
            status.textContent = text;
            status.className = "q-status" + (cls ? " " + cls : "");
            if (pct != null) bar.style.width = pct + "%";
        };

        const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        const uploaded = [];

        try {
            set("Preparing", "", 10);
            const src = await readImage(job.file);
            const full = await toJpeg(src, FULL_EDGE, 0.85);
            const thumb = await toJpeg(src, THUMB_EDGE, 0.8);
            if (src.source.close) src.source.close();
            thumbImg.src = URL.createObjectURL(thumb.blob);

            set("Uploading", "", 35);
            const store = sb.storage.from("gallery");
            const opts = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };

            let r = await store.upload("full/" + id + ".jpg", full.blob, opts);
            if (r.error) throw r.error;
            uploaded.push("full/" + id + ".jpg");
            set("Uploading", "", 70);

            r = await store.upload("thumb/" + id + ".jpg", thumb.blob, opts);
            if (r.error) throw r.error;
            uploaded.push("thumb/" + id + ".jpg");
            set("Saving", "", 90);

            const ins = await sb.from("photos")
                .insert({ file_id: id, space: job.space, width: full.width, height: full.height })
                .select()
                .single();
            if (ins.error) throw ins.error;

            photos.unshift(ins.data);
            render();
            set("Done", "ok", 100);
        } catch (err) {
            if (uploaded.length) sb.storage.from("gallery").remove(uploaded);
            const msg = err && err.message && /row-level|policy|jwt|permission/i.test(err.message)
                ? "Not allowed" : "Failed";
            set(msg, "fail", 100);
            console.error(err);
        }
    }

    // ----- drop zone -----
    const dz = $("dropzone");
    const input = $("fileInput");
    input.addEventListener("change", () => { addToQueue(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", e => addToQueue(e.dataTransfer.files));

    $("spaceSeg").addEventListener("click", e => {
        const b = e.target.closest("button[data-space]");
        if (!b) return;
        space = b.dataset.space;
        $("spaceSeg").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    });

    // ----- photo grid -----
    const grid = $("photoGrid");

    function render() {
        const count = k => photos.filter(p => k === "all" || p.space === k).length;
        $("tabs").querySelectorAll("button").forEach(b => {
            const k = b.dataset.filter;
            b.textContent = (k === "all" ? "All" : k === "venue" ? "Venue" : "Hall") + " (" + count(k) + ")";
            b.classList.toggle("active", k === filter);
        });
        $("photoCount").textContent = "";

        const list = photos.filter(p => filter === "all" || p.space === filter);
        grid.textContent = "";
        $("photoEmpty").hidden = list.length > 0;

        list.forEach(p => {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.innerHTML =
                '<img loading="lazy" alt="">' +
                '<button type="button" class="chip ' + (p.space === "hall" ? "hall" : "") + '" title="Tap to switch between Venue and Hall"></button>' +
                '<button type="button" class="del" aria-label="Delete photo"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3"/></svg></button>';
            tile.querySelector("img").src = publicUrl("thumb", p.file_id);
            tile.querySelector(".chip").textContent = p.space === "hall" ? "Hall" : "Venue";
            tile.querySelector(".chip").addEventListener("click", () => switchSpace(p));
            tile.querySelector(".del").addEventListener("click", () => askDelete(p));
            grid.appendChild(tile);
        });
    }

    $("tabs").addEventListener("click", e => {
        const b = e.target.closest("button[data-filter]");
        if (!b) return;
        filter = b.dataset.filter;
        render();
    });

    async function switchSpace(p) {
        const next = p.space === "hall" ? "venue" : "hall";
        const { error } = await sb.from("photos").update({ space: next }).eq("id", p.id);
        if (error) { C.toast("Couldn't change that photo.", "error"); return; }
        p.space = next;
        render();
    }

    // ----- delete with a confirm box -----
    const modal = $("modal");
    let pending = null;

    function askDelete(p) {
        pending = p;
        modal.hidden = false;
        $("modalOk").focus();
    }
    function closeModal() {
        pending = null;
        modal.hidden = true;
    }
    $("modalCancel").addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

    $("modalOk").addEventListener("click", async () => {
        const p = pending;
        if (!p) return;
        const btn = $("modalOk");
        btn.disabled = true;
        const { error } = await sb.from("photos").delete().eq("id", p.id);
        if (error) {
            C.toast("Couldn't delete that photo.", "error");
        } else {
            sb.storage.from("gallery").remove(["full/" + p.file_id + ".jpg", "thumb/" + p.file_id + ".jpg"]);
            photos = photos.filter(x => x.id !== p.id);
            render();
            C.toast("Photo deleted.");
        }
        btn.disabled = false;
        closeModal();
    });

    // ----- start -----
    C.ready.then(async session => {
        if (!session) return;
        sb = C.sb;
        const { data, error } = await sb.from("photos").select("*").order("created_at", { ascending: false });
        if (error) {
            C.toast("Couldn't load your photos. Did you run the setup script?", "error");
            return;
        }
        photos = data || [];
        render();
    });
})();
