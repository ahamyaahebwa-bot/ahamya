// Staff sign-in. After a successful login you go straight to the dashboard.
(function () {
    const cfg = window.CEDAR_CONFIG || {};
    const form = document.getElementById("loginForm");
    const errorEl = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");
    const pw = document.getElementById("password");
    const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/^PASTE/.test(cfg.supabaseUrl));

    function fail(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
    }

    document.getElementById("eyeBtn").addEventListener("click", function () {
        const show = pw.type === "password";
        pw.type = show ? "text" : "password";
        this.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });

    if (!configured) {
        fail("The dashboard isn't connected yet. Add your Supabase details in js/supabase-config.js.");
        btn.disabled = true;
        return;
    }
    if (!window.supabase) {
        fail("Couldn't load the login system. Check your internet connection and refresh.");
        btn.disabled = true;
        return;
    }

    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    // Already signed in? Skip the form.
    sb.auth.getSession().then(function (res) {
        if (res.data && res.data.session) location.replace("booked-dates.html");
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        errorEl.hidden = true;

        const email = document.getElementById("email").value.trim();
        const password = pw.value;
        if (!email || !password) {
            fail("Please enter your email and password.");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Signing in...";

        const { error } = await sb.auth.signInWithPassword({ email: email, password: password });

        if (error) {
            fail(/network|fetch/i.test(error.message) ? "Couldn't reach the server. Check your connection and try again." : "Incorrect email or password.");
            btn.disabled = false;
            btn.textContent = "Sign in";
            return;
        }
        location.replace("booked-dates.html");
    });
})();
