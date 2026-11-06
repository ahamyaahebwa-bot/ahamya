// Dashboard > Booking requests: list requests from Supabase and update price, deposit and status.
(function () {
    const C = window.CEDAR;
    const $ = id => document.getElementById(id);
    if (!C || !$("reqList")) return;

    const LABEL = { pending: "Pending", price_agreed: "Price agreed", deposit_received: "Deposit received", confirmed: "Confirmed", declined: "Declined" };
    let rows = [];
    let filter = "all";
    let current = null;
    const freshIds = new Set();   // requests that were new when this page was opened

    const money = n => "UGX " + Number(n || 0).toLocaleString("en-US");
    const niceDate = s => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const dates = r => r.start_date === r.end_date ? niceDate(r.start_date) : niceDate(r.start_date) + " to " + niceDate(r.end_date);

    function drawStats() {
        $("stPending").textContent = rows.filter(r => r.status === "pending").length;
        $("stPrice").textContent = rows.filter(r => r.status === "price_agreed").length;
        $("stConfirmed").textContent = rows.filter(r => r.status === "confirmed").length;
    }

    function drawList() {
        const shown = rows.filter(r => filter === "all" || r.status === filter);
        const list = $("reqList");
        list.innerHTML = "";
        $("reqEmpty").hidden = shown.length > 0;
        shown.forEach(r => {
            const li = document.createElement("li");
            li.innerHTML = '<div class="r-main"><div class="r-name"></div><div class="r-meta"></div></div><span class="status-pill"></span>';
            li.querySelector(".r-name").textContent = r.customer_name;
            if (freshIds.has(r.id)) {
                const tag = document.createElement("span");
                tag.className = "new-tag";
                tag.textContent = "New";
                li.querySelector(".r-name").appendChild(tag);
            }
            li.querySelector(".r-meta").textContent = r.space + " · " + dates(r) + " · " + r.event_type;
            const p = li.querySelector(".status-pill");
            p.textContent = LABEL[r.status] || r.status;
            p.classList.add(r.status);
            li.addEventListener("click", () => openModal(r));
            list.appendChild(li);
        });
    }

    function updateBalance() {
        const price = parseFloat($("mPrice").value) || 0;
        const dep = parseFloat($("mDeposit").value) || 0;
        $("mBalance").textContent = price ? "Remaining balance: " + money(Math.max(price - dep, 0)) : "";
    }

    function openModal(r) {
        current = r;
        $("mName").textContent = r.customer_name;
        $("mRef").textContent = "Reference " + r.reference;
        $("mFacts").innerHTML =
            "<dt>Venue</dt><dd>" + C.esc(r.space) + "</dd>" +
            "<dt>Dates</dt><dd>" + C.esc(dates(r)) + "</dd>" +
            "<dt>Event</dt><dd>" + C.esc(r.event_type) + "</dd>" +
            "<dt>Guests</dt><dd>" + C.esc(r.guests) + "</dd>" +
            '<dt>Phone</dt><dd><a href="tel:' + C.esc(r.customer_phone) + '">' + C.esc(r.customer_phone) + "</a></dd>" +
            '<dt>Email</dt><dd><a href="mailto:' + C.esc(r.customer_email) + '">' + C.esc(r.customer_email) + "</a></dd>" +
            (r.notes ? "<dt>Notes</dt><dd>" + C.esc(r.notes) + "</dd>" : "");

        // "Confirmed" is only set when the confirmation email is sent (next step)
        const opts = ["pending", "price_agreed", "deposit_received", "declined"];
        if (r.status === "confirmed") opts.push("confirmed");
        $("mStatus").innerHTML = opts.map(s => '<option value="' + s + '">' + LABEL[s] + "</option>").join("");
        $("mStatus").value = r.status;
        $("mStatus").disabled = r.status === "confirmed";
        $("mPrice").value = r.agreed_price != null ? r.agreed_price : "";
        $("mDeposit").value = r.deposit_amount != null ? r.deposit_amount : "";
        updateBalance();
        const canApprove = r.status === "deposit_received" && !r.confirmation_sent_at;
        $("mApprove").hidden = !canApprove;
        $("mSpaceWrap").hidden = !canApprove;
        $("mSpace").value = /venue/i.test(r.space) ? "venue" : /hall/i.test(r.space) ? "hall" : "";
        $("mSent").hidden = !r.confirmation_sent_at;
        if (r.confirmation_sent_at) $("mSent").textContent = "Confirmation email sent on " + new Date(r.confirmation_sent_at).toLocaleString("en-GB");
        $("reqModal").hidden = false;
    }

    async function approve() {
        const r = current;
        const price = parseFloat($("mPrice").value) || 0;
        const dep = parseFloat($("mDeposit").value) || 0;
        if ($("mStatus").value !== "deposit_received" || price !== Number(r.agreed_price) || dep !== Number(r.deposit_amount)) {
            C.toast("Save your changes first, then approve.", "error");
            return;
        }
        const spaceKey = $("mSpace").value;
        if (!spaceKey) { C.toast("Choose which space to block on the calendar.", "error"); return; }
        const balance = Math.max(price - dep, 0);
        if (!window.confirm("Send the booking confirmation to " + r.customer_email + " and block these dates on the calendar?\n\nPrice: " + money(price) + "\nDeposit: " + money(dep) + "\nBalance: " + money(balance))) return;

        const btn = $("mApprove");
        btn.disabled = true;
        btn.textContent = "Sending...";
        let blockId = null;
        try {
            // 1. make sure the dates are free, then block them
            const clash = await C.sb.from("blocked_dates").select("id,space").lte("start_date", r.end_date).gte("end_date", r.start_date);
            if (clash.error) throw new Error("Couldn't check the calendar.");
            if ((clash.data || []).some(x => x.space === spaceKey || x.space === "both" || spaceKey === "both")) {
                throw new Error("Those dates are already booked for that space. Check the Booked dates page.");
            }
            const blk = await C.sb.from("blocked_dates").insert({
                space: spaceKey, start_date: r.start_date, end_date: r.end_date,
                note: "Booking " + r.reference + " - " + r.customer_name, booking_id: r.id
            }).select("id").single();
            if (blk.error) throw new Error("Couldn't block the dates on the calendar.");
            blockId = blk.data.id;

            // 2. send the confirmation email
            const { data } = await C.sb.auth.getSession();
            const token = data.session && data.session.access_token;
            const res = await fetch(C.cfg.supabaseUrl + "/functions/v1/send-confirmation", {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": C.cfg.supabaseAnonKey, "Authorization": "Bearer " + token },
                body: JSON.stringify({ id: r.id })
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || "Send failed");
            C.toast("Confirmation sent and dates blocked.");
            $("reqModal").hidden = true;
            load();
        } catch (e) {
            console.error(e);
            // email failed: undo the calendar block so nothing is half done
            if (blockId) await C.sb.from("blocked_dates").delete().eq("id", blockId);
            C.toast(e.message || "Couldn't send the email.", "error");
        }
        btn.disabled = false;
        btn.textContent = "Approve & send confirmation";
    }

    async function save() {
        const btn = $("mSave");
        const price = $("mPrice").value === "" ? null : parseFloat($("mPrice").value);
        const dep = $("mDeposit").value === "" ? null : parseFloat($("mDeposit").value);
        const status = $("mStatus").value;

        if ((price !== null && price < 0) || (dep !== null && dep < 0)) { C.toast("Amounts can't be negative.", "error"); return; }
        if (price !== null && dep !== null && dep > price) { C.toast("The deposit is more than the agreed price.", "error"); return; }
        if ((status === "price_agreed" || status === "deposit_received") && !price) { C.toast("Enter the agreed price first.", "error"); return; }
        if (status === "deposit_received" && !dep) { C.toast("Enter the deposit received.", "error"); return; }

        const update = { status: status, agreed_price: price, deposit_amount: dep };
        if (status === "deposit_received" && !current.deposit_received_at) update.deposit_received_at = new Date().toISOString();

        btn.disabled = true;
        btn.textContent = "Saving...";
        const { error } = await C.sb.from("booking_requests").update(update).eq("id", current.id);
        btn.disabled = false;
        btn.textContent = "Save changes";
        if (error) { console.error(error); C.toast("Couldn't save. Please try again.", "error"); return; }
        C.toast("Saved.");
        $("reqModal").hidden = true;
        load();
    }

    async function load() {
        const btn = $("reqRefresh");
        btn.disabled = true;
        btn.textContent = "Refreshing...";
        const { data, error } = await C.sb.from("booking_requests").select("*").order("created_at", { ascending: false });
        if (error) { console.error(error); C.toast("Couldn't load requests.", "error"); }
        else rows = data || [];
        const unseen = rows.filter(x => !x.seen_at);
        unseen.forEach(x => freshIds.add(x.id));
        drawStats();
        drawList();
        btn.disabled = false;
        btn.textContent = "Refresh";

        // opening this page counts as seeing the new requests, so the badge clears
        if (unseen.length) {
            const res = await C.sb.from("booking_requests")
                .update({ seen_at: new Date().toISOString() })
                .in("id", unseen.map(x => x.id));
            if (!res.error && C.refreshBadge) C.refreshBadge();
        }
    }

    $("reqTabs").addEventListener("click", e => {
        const b = e.target.closest("button[data-f]");
        if (!b) return;
        filter = b.dataset.f;
        document.querySelectorAll("#reqTabs button").forEach(x => x.classList.toggle("active", x === b));
        drawList();
    });
    $("reqRefresh").addEventListener("click", load);
    $("mClose").addEventListener("click", () => { $("reqModal").hidden = true; });
    $("reqModal").addEventListener("click", e => { if (e.target === $("reqModal")) $("reqModal").hidden = true; });
    $("mSave").addEventListener("click", save);
    $("mApprove").addEventListener("click", approve);
    $("mPrice").addEventListener("input", updateBalance);
    $("mDeposit").addEventListener("input", updateBalance);

    C.ready.then(session => { if (session) load(); });
})();
