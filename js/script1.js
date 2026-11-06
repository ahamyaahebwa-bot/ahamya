document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".nav-links");
    const links = [...nav.querySelectorAll("a")];
    const indicator = nav.querySelector(".nav-indicator");
    const file = l => l.getAttribute("href");

    const current = location.pathname.split("/").pop() || "index.html";
    const alias = { "gallery.html": "venue.html", "videos.html": "index.html" };
    const active = links.find(a => file(a) === (alias[current] || current)) || links[0];
    
    // the tab we came from (saved when a link was tapped)
    const prev = links.find(a => file(a) === sessionStorage.getItem("prevNav"));
    sessionStorage.removeItem("prevNav");

    function setActive(link) {
        links.forEach(a => a.classList.toggle("active", a === link));
    }

    function place(link, animate) {
        indicator.style.transition = animate ? "" : "none";
        indicator.style.width = link.offsetWidth + "px";
        indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    }

    let started = false;
    new ResizeObserver(() => {
        if (!nav.offsetWidth) return;   // nav hidden (splash screen)

        if (!started) {
            started = true;
            if (prev && prev !== active) {
                // start on the old tab, then slide to the new one
                setActive(prev);
                place(prev, false);
                indicator.offsetWidth;  // force the browser to register the start position
                requestAnimationFrame(() => {
                    setActive(active);
                    place(active, true);
                });
                return;
            }
        }
        setActive(active);
        place(active, false);
    }).observe(nav);

    // on tap, remember where we are, then let the page change normally
    links.forEach(link => {
        link.addEventListener("click", () => {
            sessionStorage.setItem("prevNav", file(active));
        });
    });


    // Change navigation appearance over the footer
    
        // Change navigation and floating buttons over the footer
    const footer = document.querySelector(".footer");
    const fabs = document.querySelectorAll(".gallery-fab");

    if (footer && nav) {
        const footerObserver = new IntersectionObserver(
            ([entry]) => {
                nav.classList.toggle("footer-mode", entry.isIntersecting);
                fabs.forEach(f => f.classList.toggle("footer-mode", entry.isIntersecting));
            },
            { threshold: 0.05 }
        );

        footerObserver.observe(footer);
    }


});



