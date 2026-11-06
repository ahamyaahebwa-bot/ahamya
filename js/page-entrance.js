(() => {
    "use strict";

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    const page = window.location.pathname.split("/").pop() || "index.html";
    const targets = new Map();

    function add(selector, direction = "down", options = {}) {
        document.querySelectorAll(selector).forEach((element, index) => {
            if (
                targets.has(element) ||
                element.closest("[hidden]") ||
                window.getComputedStyle(element).display === "none"
            ) {
                return;
            }

            const delay = options.stagger
                ? Math.min(index * 90, 270)
                : options.delay || 0;

            targets.set(element, { direction, delay });
        });
    }

    // Keep the fixed bottom navigation and every ancestor of it untransformed.
    add(".navbar > .logo", "up");
    add(".navbar > .nav-social", "up", { delay: 110 });

    if (page === "index.html") {
        add(".hero > .hero-small-text", "left", { delay: 140 });
        add(".hero > .hero-card", "down", { delay: 280 });
        add(".welcome > *", "down", { stagger: true });
        add(".intro-video > *", "down");
        add(".venues > .section-heading", "down");
        add(".venues .venue-card", "down", { stagger: true });
        add(".booking-cta > *", "down", { stagger: true });
    } else if (page === "about.html") {
        add(".why-us > h2", "left");
        add(".why-us .fact", "down", { stagger: true });
        add(".find-us > *", "down");
        add(".about-container > h2, .about-container > p", "down");
        add(".about-highlights > *", "down", { stagger: true });
    } else if (page === "venue.html") {
        add(".venues-hero > *", "down", { stagger: true });
        add(".venue-showcase > *", "down");
        add(".comparison > h2", "down");
        add(".comparison .compare-card", "down", { stagger: true });
        add(".gallery > *", "down", { stagger: true });
        add(".booking-cta > *", "down", { stagger: true });
    } else if (page === "booking.html") {
        add("main h1, main h2, main h3, main h4, main h5, main h6", "left");
        add(".booking-block > p, .booking-block > .space-cards", "down", {
            stagger: true
        });
        add(
            ".booking-block .enquiry-form > label, .booking-block .enquiry-form > .row, " +
            ".booking-block .enquiry-form > button, .booking-block .enquiry-form > p, " +
            ".booking-block .enquiry-form > input",
            "down",
            { stagger: true }
        );
    } else if (page === "contact.html") {
        add("main h1, main h2, main h3, main h4, main h5, main h6", "left");
        add(".contact-intro > p", "down");
        add(".quick-contact > *", "down", { stagger: true });
        add(
            ".contact-main > .enquiry-form > label, .contact-main > .enquiry-form > button",
            "down",
            { stagger: true }
        );
        add(".visit > p, .visit > iframe, .visit > a", "down", { stagger: true });
        add(".faq > details", "down", { stagger: true });
    } else if (page === "videos.html") {
        add(".gp-head > *", "down", { stagger: true });
        add(".gp-cta > *", "down", { stagger: true });
    }  else if (page === "gallery.html") {
        add(".dash-top", "up");
        add(".dash-side .side-label", "left");
        add(".dash-side .side-link", "down", { stagger: true });
        add(".dash-main .page-head > *", "down", { stagger: true });
        add(".dash-main > .card", "down", { stagger: true });

    } else if (page === "booked-dates.html") {
        add(".dash-top", "up");
        add(".dash-side .side-label", "left");
        add(".dash-side .side-link", "down", { stagger: true });
        add(".dash-main .page-head > *", "down", { stagger: true });
        add(".stats > .stat", "down", { stagger: true });
        add(".two-col > .card", "down", { stagger: true });
    }  else if (page === "login.html") {
        add(".login-logo", "up");
        add(".login-title", "down", { delay: 100 });
        add(".login-sub", "down", { delay: 180 });
        add(".login-card", "down", { delay: 260 });
        add(".login-foot", "down", { delay: 360 });
    }
    
    // Footer content follows the same gentle upward reveal on every public page.
    add(".footer .footer-column", "down", { stagger: true });
    add(".footer .footer-bottom", "down");

    // Release the head-script gate (see motion-pending in page-entrance.css).
    const release = () =>
        document.documentElement.classList.remove("motion-pending");

    if (!targets.size) {
        release();
        return;
    }

    document.documentElement.classList.add("page-motion-ready");

    function reveal(element) {
        const motion = targets.get(element);
        if (!motion || element.classList.contains("motion-play")) return;

        let fallbackTimer;

        const cleanup = () => {
            window.clearTimeout(fallbackTimer);
            element.removeEventListener("animationend", onAnimationEnd);
            element.classList.remove(
                "motion-item",
                "motion-play",
                "motion-from-left",
                "motion-from-up"
            );
            element.style.removeProperty("--motion-delay");
        };

        const onAnimationEnd = event => {
            if (
                event.target !== element ||
                !event.animationName.startsWith("cedar-page-fly-")
            ) {
                return;
            }
            cleanup();
        };

        element.classList.add("motion-item");
        if (motion.direction === "left") element.classList.add("motion-from-left");
        if (motion.direction === "up") element.classList.add("motion-from-up");
        if (motion.delay) {
            element.style.setProperty("--motion-delay", `${motion.delay}ms`);
        }
        element.addEventListener("animationend", onAnimationEnd);
        element.classList.add("motion-play");
        // Also clears classes if the animation is canceled or motion settings change.
        fallbackTimer = window.setTimeout(cleanup, 1400);
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            currentObserver.unobserve(entry.target);
            reveal(entry.target);
        });
    }, {
        threshold: 0.08,
        rootMargin: "0px 0px 80px 0px"
    });

    const initiallyVisible = [];
    targets.forEach((_, element) => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
            initiallyVisible.push(element);
        } else {
            observer.observe(element);
        }
    });

    // Start the entrances and un-hide the page in the same step, so the
    // text is never visible "in place" before it flies in.
    initiallyVisible.forEach(reveal);
    release();
})();
