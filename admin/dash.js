// Shared by every dashboard page: connects to Supabase, checks you are logged in,
// runs the sidebar and gives the pages a few helpers (window.CEDAR).
(function () {
    const cfg = window.CEDAR_CONFIG || {};
    const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/^PASTE/.test(cfg.supabaseUrl));

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // ----- small toast messages -----
    function toast(message, type) {
        let wrap = document.querySelector(".toast-wrap");
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.className = "toast-wrap";
            document.body.appendChild(wrap);
        }
        const t = document.createElement("div");
        t.className = "toast" + (type === "error" ? " error" : "");
        t.textContent = message;
        wrap.appendChild(t);
        setTimeout(() => t.remove(), 3800);
    }

    // ----- sidebar (phone menu) -----
    const side = document.getElementById("dashSide");
    const backdrop = document.getElementById("sideBackdrop");
    const menuBtn = document.getElementById("menuBtn");
    function setSide(open) {
        if (!side) return;
        side.classList.toggle("open", open);
        if (backdrop) backdrop.hidden = !open;
    }
    if (menuBtn) menuBtn.addEventListener("click", () => setSide(!side.classList.contains("open")));
    if (backdrop) backdrop.addEventListener("click", () => setSide(false));

    // ----- when something is not set up yet -----
    function blocked(message) {
        document.body.classList.remove("auth-pending");
        const main = document.querySelector(".dash-main");
        if (main) main.innerHTML = '<div class="notice">' + message + "</div>";
    }

    const api = { cfg: cfg, configured: configured, sb: null, ready: Promise.resolve(null), esc: esc, toast: toast };
    window.CEDAR = api;

    if (!document.body.classList.contains("dash")) return;   // login page only needs the helpers above

    if (!configured) {
        blocked("<strong>The dashboard isn't connected yet.</strong><br>Add your Supabase details in <code>js/supabase-config.js</code> (SETUP.md, Part 1).");
        return;
    }
    if (!window.supabase) {
        blocked("<strong>Couldn't load the login system.</strong><br>Check your internet connection and refresh the page.");
        return;
    }

    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    api.sb = sb;

    let leaving = false;
    function toLogin() {
        if (leaving) return;
        leaving = true;
        location.replace("login.html");
    }

    api.ready = sb.auth.getSession().then(function (res) {
        const session = res.data && res.data.session;
        if (!session) {
            toLogin();
            return null;
        }
        const email = session.user.email || "";
        document.querySelectorAll("[data-user-email]").forEach(el => { el.textContent = email; });
        document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = (email[0] || "A").toUpperCase(); });
        document.body.classList.remove("auth-pending");
        return session;
    });

    sb.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT") toLogin();
    });

    // ----- "new requests" badge on the Booking requests link and the phone menu button -----
    const baseTitle = document.title;
    const badges = [];
    function addBadge(parent) {
        if (!parent) return;
        const b = document.createElement("span");
        b.className = "nav-badge";
        b.hidden = true;
        parent.appendChild(b);
        badges.push(b);
    }
    addBadge(document.querySelector('.side-link[href="requests.html"]'));
    addBadge(document.getElementById("menuBtn"));

    function showCount(n) {
        badges.forEach(function (b) {
            b.hidden = n < 1;
            b.textContent = n > 99 ? "99+" : String(n);
        });
        document.title = (n > 0 ? "(" + n + ") " : "") + baseTitle;
    }

    api.refreshBadge = function () {
        return sb.from("booking_requests")
            .select("id", { count: "exact", head: true })
            .is("seen_at", null)
            .then(function (res) { if (!res.error && res.count !== null) showCount(res.count); });
    };

    api.ready.then(function (session) {
        if (!session) return;
        api.refreshBadge();
        setInterval(api.refreshBadge, 60000);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) api.refreshBadge(); });
    });

    document.querySelectorAll("[data-signout]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            sb.auth.signOut().finally(toLogin);
        });
    });
})();
