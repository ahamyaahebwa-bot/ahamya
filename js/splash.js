(() => {
    const key = "cedarParkSplashVisited";

    const navigation =
        performance.getEntriesByType("navigation")[0];

    const isReload = navigation?.type === "reload";
    const isFirstVisit = !sessionStorage.getItem(key);

    // Remember the visit for this tab.
    sessionStorage.setItem(key, "true");

    // Do not show on ordinary page navigation.
    if (!isFirstVisit && !isReload) return;

    const splash = document.createElement("div");
    splash.className = "cedar-splash";

    const logo = document.createElement("img");
    logo.src = "images/cedar-logo.png";
    logo.alt = "Cedar Park logo";

    
    const subtitle = document.createElement("p");
    subtitle.textContent = "EVENTS & CELEBRATIONS";

    splash.append(logo, subtitle);
    document.documentElement.appendChild(splash);

    // Keep the splash visible for 1.6 seconds.
    setTimeout(() => {
        splash.classList.add("splash-hidden");

        setTimeout(() => splash.remove(), 750);
    }, 2500);
})();