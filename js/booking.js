// ===== Settings: change these =====
const ACCESS_KEY = "0e93a033-8ed1-45f9-8470-1de89c5219e1";   // from web3forms.com (see notes)
const WHATSAPP = "256701887955";                  // no + or spaces
const PHONE_DISPLAY = "+256 701 887 955";

const SPACES = {
    venue: {
        name: "Cedar Park Venue",
        img: "images/cedar-park-venue.jpg",
        about: "A spacious outdoor venue for weddings, conferences, celebrations and large gatherings.",
        facts: ["Large capacity (up to 1000+ people)", "Outdoor setting", "Parking available", "Flexible layouts", "Changing rooms"],
        
    },
    hall: {
        name: "Cedar Park Hall",
        img: "images/cedar-park-hall.jpg",
        about: "A comfortable indoor hall for gatherings, small weddings and meetings of 100 to 170 guests.",
        facts: ["Indoor venue", "Weather protected", "Ideal for meetings", "Modern facilities", "Sound proof"],
        
    },
    unsure: {
        name: "Not sure yet",
        img: "",
        about: "Tell us about your event below and we'll help you choose between the venue and the hall.",
        facts: [],
        
    }
};

const $ = id => document.getElementById(id);
const key = new URLSearchParams(location.search).get("space");
const space = SPACES[key];

// ===== Which state to show =====
if (space) {
    $("chooser").hidden = true;
    $("chosen").hidden = false;

    $("summary").innerHTML =
        (space.img ? `<img src="${space.img}" alt="${space.name}">` : "") +
        `<div>
            <h2>${space.name}</h2>
            <p>${space.about}</p>` +
        (space.facts.length ? `<ul>${space.facts.map(f => `<li>${f}</li>`).join("")}</ul>` : "") +
        (space.price ? `<p class="from">${space.price} <small>(indicative, final price agreed with the manager)</small></p>` : "") +
        `<a class="change-link" href="booking.html">Change space</a>
        </div>`;
}

// ===== Date rules =====
const start = $("startDate");
const end = $("endDate");
const today = new Date().toISOString().split("T")[0];
start.min = today;
end.min = today;

function updateDays() {
    if (start.value) end.min = start.value;
    if (start.value && end.value && end.value < start.value) end.value = start.value;

    if (start.value && end.value) {
        const days = Math.round((new Date(end.value) - new Date(start.value)) / 86400000) + 1;
        $("daysHint").textContent = days + (days === 1 ? " day" : " days") + " selected.";
    }
}
start.addEventListener("change", updateDays);
end.addEventListener("change", updateDays);

// ===== Submit =====
function makeRef() {
    const d = new Date();
    const stamp = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "CP-" + stamp + "-" + Math.floor(1000 + Math.random() * 9000);
}

$("enquiryForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("submitBtn");
    const err = $("formError");
    err.hidden = true;

    const clash = findClash(start.value, end.value);
    if (clash) {
        err.textContent = "Sorry, " + niceDate(clash) + " is already booked. Please choose different dates.";
        err.hidden = false;
        return;
    }

    const ref = makeRef();
    const data = Object.fromEntries(new FormData(e.target));
    data.access_key = ACCESS_KEY;
    data.subject = "New booking request " + ref + ": " + space.name;
    data.from_name = "Cedar Park Website";
    data.reference = ref;
    data.space = space.name;

    btn.disabled = true;
    btn.textContent = "Sending...";

    // 1) Save to the dashboard database (plain web request, retried if the network hiccups)
    const cfg = window.CEDAR_CONFIG;
    const wait = ms => new Promise(r => setTimeout(r, ms));

    async function saveBooking(row) {
        if (!cfg) throw new Error("Missing Supabase settings");
        let lastErr;
        for (let i = 0; i < 3; i++) {
            try {
                const res = await fetch(cfg.supabaseUrl + "/rest/v1/booking_requests", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": cfg.supabaseAnonKey,
                        "Authorization": "Bearer " + cfg.supabaseAnonKey,
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify(row)
                });
                if (res.ok || res.status === 409) return;   // 409 = an earlier try already saved it
                lastErr = new Error("Save failed: " + res.status + " " + (await res.text()));
                if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) break;
            } catch (err) {
                lastErr = err;
            }
            await wait(800 * (i + 1));
        }
        throw lastErr;
    }

    // 2) Ask the server to send the "Request received" email (also retried)
    async function sendAck(reference) {
        for (let i = 0; i < 3; i++) {
            try {
                const res = await fetch(cfg.supabaseUrl + "/functions/v1/send-ack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "apikey": cfg.supabaseAnonKey },
                    body: JSON.stringify({ reference: reference }),
                    keepalive: true
                });
                if (res.ok) return;
                console.error("Acknowledgement email attempt " + (i + 1) + " failed:", res.status);
            } catch (err) {
                console.error("Acknowledgement email attempt " + (i + 1) + " failed:", err);
            }
            await wait(1500 * (i + 1));
        }
    }

    // 3) Web3Forms email to you (it also says whether the dashboard save worked)
    const sendToWeb3Forms = async () => {
        const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
    };

    try {
        let saved = false;
        try {
            await saveBooking({
                reference: ref,
                customer_name: data.name,
                customer_phone: data.phone,
                customer_email: data.email,
                event_type: data.event_type,
                space: space.name,
                start_date: data.start_date,
                end_date: data.end_date,
                guests: parseInt(data.guests, 10),
                notes: data.notes || null
            });
            saved = true;
        } catch (err) {
            console.error("Supabase save failed:", err);
        }

        data.dashboard_saved = saved ? "Yes" : "NO - this request is NOT in the dashboard. Please add it manually.";
        if (saved) sendAck(ref);   // runs in the background, retried if needed

        let mailed = false;
        try {
            await sendToWeb3Forms();
            mailed = true;
        } catch (err) {
            console.error("Web3Forms failed:", err);
        }
        if (!saved && !mailed) throw new Error("Both failed");

        $("chosen").hidden = true;
        $("done").hidden = false;
        $("refCode").textContent = ref;
        $("refDetails").textContent = space.name + ", " + data.start_date +
            (data.end_date !== data.start_date ? " to " + data.end_date : "");
        $("waLink").href = "https://wa.me/" + WHATSAPP + "?text=" +
            encodeURIComponent("Hello Cedar Park, my booking request reference is " + ref + ".");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        err.textContent = "We couldn't send your booking request. Please try again, or call us on " + PHONE_DISPLAY + ".";
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = "Send booking request";
    }
});