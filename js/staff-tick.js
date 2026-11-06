// Small staff-login tick. One <script> line per page adds it; no other edits needed.
// Desktop: floats in the bottom-right corner. Phones: sits at the end of the copyright line.
(function () {
    var css = document.createElement("style");
    css.textContent =
        ".staff-tick{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;" +
        "border-radius:50%;background:rgba(255,255,255,.72);border:1px solid rgba(22,69,42,.14);color:#16452a;" +
        "opacity:.4;text-decoration:none;transition:opacity .25s ease,transform .25s ease;" +
        "-webkit-tap-highlight-color:transparent;vertical-align:middle;margin-left:8px}" +
        ".staff-tick:hover,.staff-tick:focus-visible,.staff-tick:active{opacity:1;transform:scale(1.06)}" +
        ".staff-tick svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}" +
        "@media (min-width:769px){.staff-tick{position:fixed;right:18px;bottom:18px;margin:0;z-index:40}}" +
        "@media (max-width:640px){" +
        ".staff-tick{" +
        "position:fixed;" +
        "right:max(6%,calc(50% - 230px));" +
        "bottom:156px;" +
        "width:30px;" +
        "height:30px;" +
        "margin:0;" +
        "z-index:1001;" +
        "}" +
        "}";
    document.head.appendChild(css);

    var link = document.createElement("a");
    link.className = "staff-tick";
    link.href = "admin/login.html";
    link.setAttribute("aria-label", "Staff login");
    link.title = "Staff";
    link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

    // Desktop: lives directly on the page so it is always visible (the footer fades in on scroll).
    // Phones: sits at the end of the copyright line in the footer.
    var phone = window.matchMedia("(max-width: 640px)");
    function place() {
        var host = document.body;
        if (link.parentNode !== host) host.appendChild(link);
    }
    place();
    if (phone.addEventListener) phone.addEventListener("change", place);
    else if (phone.addListener) phone.addListener(place);
})();
