// Dashboard > Booked dates: add, view and remove booked dates (stored in Supabase, table blocked_dates).
(function () {
    const C = window.CEDAR;
    const $ = id => document.getElementById(id);
    if (!C || !$("calGrid")) return;

    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const LABEL = { venue: "Venue", hall: "Hall", both: "Venue + Hall" };

    const pad = n => String(n).padStart(2, "0");
    const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
    const toDate = s => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
    const nice = s => { const d = toDate(s); return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); };
    const niceShort = s => { const d = toDate(s); return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); };

    const now = new Date();
    const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());
    const firstYear = now.getFullYear();
    const firstMonth = now.getMonth();
    let year = firstYear;
    let month = firstMonth;
    let rows = [];

    const covers = (r, key, date) => (r.space === key || r.space === "both") && date >= r.start && date <= r.end;
    const overlaps = (r, space, start, end) => (r.space === space || r.space === "both" || space === "both") && r.start <= end && r.end >= start;

    function drawCalendar() {
        $("calTitle").textContent = MONTHS[month] + " " + year;
        const ahead = (year - firstYear) * 12 + (month - firstMonth);
        $("calPrev").disabled = ahead <= 0;
        $("calNext").disabled = ahead >= 18;

        const startDay = (new Date(year, month, 1).getDay() + 6) % 7;
        const days = new Date(year, month + 1, 0).getDate();
        let html = DOW.map(d => '<span class="dow">' + d + "</span>").join("");
        for (let i = 0; i < startDay; i++) html += "<span></span>";

        for (let d = 1; d <= days; d++) {
            const date = iso(year, month, d);
            const v = rows.some(r => covers(r, "venue", date));
            const h = rows.some(r => covers(r, "hall", date));
            let cls = "cal-day";
            if (date < todayISO) cls += " past";
            if (date === todayISO) cls += " today";
            if (v || h) cls += " booked";
            const title = v && h ? "Venue and Hall booked" : v ? "Venue booked" : h ? "Hall booked" : "";
            html += '<span class="' + cls + '"' + (title ? ' title="' + title + '"' : "") + ">" + d +
                ((v || h) ? '<i class="dots">' + (v ? '<b class="v"></b>' : "") + (h ? '<b class="h"></b>' : "") + "</i>" : "") + "</span>";
        }
        $("calGrid").innerHTML = html;
    }

    function drawList() {
        const upcoming = rows.filter(r => r.end >= todayISO).sort((a, b) => a.start.localeCompare(b.start));
        const list = $("bookingList");
        list.innerHTML = "";
        $("bookingEmpty").hidden = upcoming.length > 0;

        upcoming.forEach(r => {
            const days = Math.round((toDate(r.end) - toDate(r.start)) / 86400000) + 1;
            const until = Math.round((toDate(r.start) - toDate(todayISO)) / 86400000);
            const when = until > 0 ? "In " + until + (until === 1 ? " day" : " days") : "Happening now";
            const li = document.createElement("li");
            li.innerHTML = '<div><div class="b-dates"></div><div class="b-meta"></div><div class="b-note"></div></div>' +
                '<div class="b-right"><span class="pill"></span><button type="button" class="b-remove">Remove</button></div>';
            li.querySelector(".b-dates").textContent = r.start === r.end ? nice(r.start) : niceShort(r.start) + " to " + nice(r.end);
            li.querySelector(".b-meta").textContent = days + (days === 1 ? " day" : " days") + " · " + when;
            li.querySelector(".b-note").textContent = r.note || "";
            const pill = li.querySelector(".pill");
            pill.textContent = LABEL[r.space] || r.space || "Booked";
            pill.classList.add(r.space === "hall" ? "hall" : r.space === "both" ? "both" : "venue");
            li.querySelector(".b-remove").addEventListener("click", () => removeRow(r));
            list.appendChild(li);
        });

        $("statUpcoming").textContent = upcoming.length;
        if (upcoming.length) {
            const n = upcoming[0];
            $("statNext").textContent = niceShort(n.start);
            $("statNextSub").textContent = LABEL[n.space] || "";
        } else {
            $("statNext").textContent = "None";
            $("statNextSub").textContent = "";
        }
    }

    async function load() {
        const btn = $("refreshBtn");
        btn.disabled = true;
        btn.textContent = "Refreshing...";
        const { data, error } = await C.sb.from("blocked_dates")
            .select("id,space,start_date,end_date,note,booking_id")
            .order("start_date", { ascending: true });
        if (error) {
            console.error(error);
            C.toast("Couldn't load the booked dates.", "error");
        } else {
            rows = (data || []).map(r => ({ id: r.id, space: r.space, start: r.start_date, end: r.end_date, note: r.note, booking_id: r.booking_id }));
            const t = new Date();
            $("statChecked").textContent = pad(t.getHours()) + ":" + pad(t.getMinutes());
        }
        drawCalendar();
        drawList();
        btn.disabled = false;
        btn.textContent = "Refresh";
    }

    async function removeRow(r) {
        const what = (LABEL[r.space] || "") + ", " + (r.start === r.end ? nice(r.start) : nice(r.start) + " to " + nice(r.end));
        if (!window.confirm("Remove this booked date?\n\n" + what + "\n\nThe dates will become available on the website again.")) return;
        const { error } = await C.sb.from("blocked_dates").delete().eq("id", r.id);
        if (error) { console.error(error); C.toast("Couldn't remove it. Please try again.", "error"); return; }
        C.toast("Removed.");
        load();
    }

    // ----- add dates -----
    function openAdd() {
        $("aSpace").value = "venue";
        $("aStart").value = "";
        $("aEnd").value = "";
        $("aNote").value = "";
        $("addModal").hidden = false;
    }

    async function saveAdd() {
        const space = $("aSpace").value;
        const start = $("aStart").value;
        const end = $("aEnd").value || start;
        const note = $("aNote").value.trim();
        if (!start) { C.toast("Choose the first date.", "error"); return; }
        if (end < start) { C.toast("The end date is before the start date.", "error"); return; }
        if (end < todayISO) { C.toast("Those dates are in the past.", "error"); return; }
        if (rows.some(r => overlaps(r, space, start, end))) {
            C.toast("Some of those dates are already booked for that space.", "error");
            return;
        }
        const btn = $("aSave");
        btn.disabled = true;
        btn.textContent = "Saving...";
        const { error } = await C.sb.from("blocked_dates").insert({ space: space, start_date: start, end_date: end, note: note || null });
        btn.disabled = false;
        btn.textContent = "Save";
        if (error) { console.error(error); C.toast("Couldn't save. Please try again.", "error"); return; }
        C.toast("Dates added.");
        $("addModal").hidden = true;
        load();
    }

    // ----- one-time import from the old Google Sheet -----
    function parseCSV(text) {
        const ok = /^\d{4}-\d{2}-\d{2}$/;
        return text.split(/\r?\n/).slice(1).map(line => {
            const c = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
            return { space: (c[0] || "").toLowerCase(), start: c[1] || "", end: c[2] || c[1] || "" };
        }).filter(r => ok.test(r.start) && ok.test(r.end) && LABEL[r.space] && r.end >= r.start);
    }

    async function importSheet() {
        if (!window.confirm("Copy the dates from your Google Sheet into the dashboard?\n\nDates already here are skipped, so it is safe to run twice.")) return;
        const btn = $("importBtn");
        btn.disabled = true;
        btn.textContent = "Importing...";
        try {
            const url = C.cfg.sheetCsv + (C.cfg.sheetCsv.includes("?") ? "&" : "?") + "t=" + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const found = parseCSV(await res.text());
            const fresh = found.filter(f => !rows.some(r => r.space === f.space && r.start === f.start && r.end === f.end));
            if (!fresh.length) { C.toast("Nothing new to import."); }
            else {
                const { error } = await C.sb.from("blocked_dates").insert(
                    fresh.map(f => ({ space: f.space, start_date: f.start, end_date: f.end, note: "Imported from Google Sheet" })));
                if (error) throw error;
                C.toast("Imported " + fresh.length + (fresh.length === 1 ? " booking." : " bookings."));
            }
        } catch (e) {
            console.error(e);
            C.toast("Couldn't import from the Google Sheet.", "error");
        }
        btn.disabled = false;
        btn.textContent = "Import from Google Sheet";
        load();
    }

    $("calPrev").addEventListener("click", () => { if (--month < 0) { month = 11; year--; } drawCalendar(); });
    $("calNext").addEventListener("click", () => { if (++month > 11) { month = 0; year++; } drawCalendar(); });
    $("refreshBtn").addEventListener("click", load);
    $("addBtn").addEventListener("click", openAdd);
    $("aClose").addEventListener("click", () => { $("addModal").hidden = true; });
    $("addModal").addEventListener("click", e => { if (e.target === $("addModal")) $("addModal").hidden = true; });
    $("aSave").addEventListener("click", saveAdd);
    $("aStart").addEventListener("change", () => { if (!$("aEnd").value || $("aEnd").value < $("aStart").value) $("aEnd").value = $("aStart").value; });

    if (C.cfg.sheetCsv && !/^PASTE/.test(C.cfg.sheetCsv)) {
        $("importBtn").hidden = false;
        $("importBtn").addEventListener("click", importSheet);
    }

    C.ready.then(session => { if (session) load(); });
})();
