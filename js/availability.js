// Booked dates are read from Supabase (table: blocked_dates), managed in the admin dashboard.

(function () {
    const params = new URLSearchParams(location.search);
    const formKey = params.get("space");
    const datesMode = params.get("view") === "dates";

    const formSection = document.getElementById("availability");
    const formCalEl = document.getElementById("cal");
    const datesView = document.getElementById("datesView");
    const datesCalEl = document.getElementById("calDates");

    const formActive = (formKey === "venue" || formKey === "hall") && formCalEl;
    const datesActive = datesMode && datesView && datesCalEl;

    if (!formActive && formSection) formSection.hidden = true;
    if (!formActive && !datesActive) return;

    const MONTHS = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const pad = n => String(n).padStart(2, "0");
    const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);

    const now = new Date();
    const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());
    const firstYear = now.getFullYear();
    const firstMonth = now.getMonth();

    let rows = [];
    let loaded = false;
    let failed = false;
    const renderers = [];

    window.niceDate = function (s) {
        const [y, m, d] = s.split("-").map(Number);
        return d + " " + MONTHS[m - 1].slice(0, 3) + " " + y;
    };

    function isBooked(dateISO, key) {
        return rows.some(r =>
            (key === "all" || r.space === key || r.space === "both") &&
            dateISO >= r.start && dateISO <= r.end);
    }

    // first booked date inside a range for the chosen space, or null (used by the form)
    window.findClash = function (startISO, endISO) {
        if (!loaded || !formActive || !startISO || !endISO) return null;
        const [sy, sm, sd] = startISO.split("-").map(Number);
        const cur = new Date(sy, sm - 1, sd);
        for (let i = 0; i < 366; i++) {
            const s = iso(cur.getFullYear(), cur.getMonth(), cur.getDate());
            if (s > endISO) break;
            if (isBooked(s, formKey)) return s;
            cur.setDate(cur.getDate() + 1);
        }
        return null;
    };

    // one calendar in one container; getKey() says which space to show
    function makeCalendar(el, getKey) {
        let year = firstYear;
        let month = firstMonth;

        function render() {
            const key = getKey();
            const startDay = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const ahead = (year - firstYear) * 12 + (month - firstMonth);

            let html =
                '<div class="cal-head">' +
                '<button type="button" data-prev aria-label="Previous month"' + (ahead <= 0 ? " disabled" : "") + '>&#8249;</button>' +
                "<strong>" + MONTHS[month] + " " + year + "</strong>" +
                '<button type="button" data-next aria-label="Next month"' + (ahead >= 18 ? " disabled" : "") + '>&#8250;</button>' +
                "</div>" +
                '<div class="cal-grid">' + DOW.map(d => '<span class="dow">' + d + "</span>").join("");

            for (let i = 0; i < startDay; i++) html += "<span></span>";

            for (let d = 1; d <= daysInMonth; d++) {
                const date = iso(year, month, d);
                let cls = "day";
                let title = "";
                let dots = "";
                if (key === "all") cls += " tall";
                if (date < todayISO) cls += " past";
                else if (loaded) {
                    if (key === "all") {
                        const v = isBooked(date, "venue");
                        const h = isBooked(date, "hall");
                        if (v || h) {
                            cls += " booked";
                            title = ' title="' + (v && h ? "Venue and Hall booked" : v ? "Venue booked" : "Hall booked") + '"';
                            dots = '<i class="dots">' + (v ? '<b class="dot-v"></b>' : "") + (h ? '<b class="dot-h"></b>' : "") + "</i>";
                        }
                    } else if (isBooked(date, key)) {
                        cls += " booked";
                        title = ' title="Booked"';
                    }
                }
                if (date === todayISO) cls += " today";
                html += '<span class="' + cls + '"' + title + ">" + d + dots + "</span>";
            }
            html += "</div>";

            if (failed) html += '<p class="cal-note">We couldn\'t load the booked dates right now. We will confirm availability when we contact you.</p>';
            else if (!loaded) html += '<p class="cal-note">Loading booked dates...</p>';

            el.innerHTML = html;

            el.querySelector("[data-prev]").onclick = () => {
                month--; if (month < 0) { month = 11; year--; }
                render();
            };
            el.querySelector("[data-next]").onclick = () => {
                month++; if (month > 11) { month = 0; year++; }
                render();
            };
        }

        renderers.push(render);
        render();
    }

    // calendar inside the enquiry page
    if (formActive) {
        makeCalendar(formCalEl, () => formKey);
    }

    // stand-alone "booked dates" view (opened from the calendar button)
    if (datesActive) {
        const chooser = document.getElementById("chooser");
        if (chooser) chooser.hidden = true;
        datesView.hidden = false;
        document.querySelectorAll(".dates-fab").forEach(b => { b.style.display = "none"; });

        makeCalendar(datesCalEl, () => "all");
    }

    async function load() {
        try {
            const cfg = window.CEDAR_CONFIG;
            if (!cfg) throw new Error("Missing Supabase settings");
            const res = await fetch(cfg.supabaseUrl + "/rest/v1/blocked_dates?select=space,start_date,end_date&end_date=gte." + todayISO, {
                headers: { "apikey": cfg.supabaseAnonKey, "Authorization": "Bearer " + cfg.supabaseAnonKey }
            });
            if (!res.ok) throw new Error("Load failed: " + res.status);
            const data = await res.json();
            rows = data.map(r => ({ space: r.space, start: r.start_date, end: r.end_date }));
            loaded = true;
        } catch (e) {
            console.error("Could not load booked dates:", e);
            failed = true;
        }
        renderers.forEach(r => r());
    }

    load();
})();

