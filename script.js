// =========================================================
//  GLOBAL ELEMENTS
// =========================================================
const searchContainer = document.getElementById("searchContainer");
const urlInput = document.getElementById("urlInput");
const savedContainer = document.getElementById("savedSites");
const workingContainer = document.getElementById("workingSites");
const viewer = document.getElementById("viewer");
const autoBox = document.getElementById("autocomplete");
const tstBtn = document.getElementById("tstBtn");

let embedMode = "iframe";
let popupMode = "about";
let currentUrl = "";
let coreEl = null;

let workingSites = [];
let testingPaused = false;
let testingInProgress = false;
let testedCount = 0;

// =========================================================
//  MENU TOGGLE
// =========================================================
openBtn.onclick = () => {
    searchContainer.classList.toggle("active");
};

// =========================================================
//  AUTOCOMPLETE
// =========================================================
let autoTimer = null;

urlInput.addEventListener("input", () => {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(runAutocomplete, 80);
});

function runAutocomplete() {
    const val = urlInput.value.toLowerCase();
    autoBox.innerHTML = "";
    if (!val) return;

    for (const site of siteDB) {
        if (
            site.name.toLowerCase().includes(val) ||
            site.url.toLowerCase().includes(val)
        ) {
            const item = document.createElement("div");
            item.className = "autoItem";
            item.textContent = `${site.name} — ${site.url}`;
            item.onclick = () => {
                urlInput.value = site.url;
                autoBox.innerHTML = "";
            };
            autoBox.appendChild(item);
        }
    }
}

// =========================================================
//  EMBED MODE SWITCHING
// =========================================================
document.querySelectorAll(".modeBtn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".modeBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        embedMode = btn.dataset.mode;
        if (currentUrl) updateViewer(currentUrl);
    });
});

// =========================================================
//  VIEWER
// =========================================================
function updateViewer(url) {
    currentUrl = url;
    if (!url) {
        viewer.innerHTML = "";
        coreEl = null;
        return;
    }

    if (!coreEl) {
        coreEl = document.createElement("iframe");
        coreEl.style.width = "100%";
        coreEl.style.height = "100%";
        coreEl.style.border = "none";
        viewer.innerHTML = "";
        viewer.appendChild(coreEl);
    }

    if (embedMode === "iframe" && coreEl.tagName !== "IFRAME") {
        const newEl = document.createElement("iframe");
        copyCoreProps(coreEl, newEl);
        coreEl.replaceWith(newEl);
        coreEl = newEl;
    } else if (embedMode === "object" && coreEl.tagName !== "OBJECT") {
        const newEl = document.createElement("object");
        copyCoreProps(coreEl, newEl);
        newEl.type = "text/html";
        coreEl.replaceWith(newEl);
        coreEl = newEl;
    } else if (embedMode === "embed" && coreEl.tagName !== "EMBED") {
        const newEl = document.createElement("embed");
        copyCoreProps(coreEl, newEl);
        newEl.type = "text/html";
        coreEl.replaceWith(newEl);
        coreEl = newEl;
    }

    if (embedMode === "iframe" || embedMode === "embed") {
        coreEl.src = url;
    } else {
        coreEl.data = url;
    }
}

function copyCoreProps(oldEl, newEl) {
    newEl.style.cssText = oldEl.style.cssText;
    if (oldEl.src) newEl.src = oldEl.src;
    if (oldEl.data) newEl.data = oldEl.data;
}

// =========================================================
//  BASIC ACTIONS
// =========================================================
function loadSite() {
    let url = urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    updateViewer(url);
}

goBtn.onclick = loadSite;

document.addEventListener("keydown", e => {
    if (e.key === "Enter") loadSite();
});

// =========================================================
//  SAVED SITES
// =========================================================
function saveSite() {
    const urlToSave = currentUrl || urlInput.value.trim();
    if (!urlToSave) return;

    const savedSites = JSON.parse(localStorage.getItem("savedSites")) || [];

    if (!savedSites.includes(urlToSave)) {
        savedSites.push(urlToSave);
        localStorage.setItem("savedSites", JSON.stringify(savedSites));
        displaySavedSites();
    }
}

saveBtn.onclick = saveSite;

function deleteSite(index) {
    const savedSites = JSON.parse(localStorage.getItem("savedSites")) || [];
    savedSites.splice(index, 1);
    localStorage.setItem("savedSites", JSON.stringify(savedSites));
    displaySavedSites();
}

function displaySavedSites() {
    savedContainer.innerHTML = "";
    const savedSites = JSON.parse(localStorage.getItem("savedSites")) || [];

    savedSites.forEach((site, index) => {
        const item = document.createElement("div");
        item.className = "savedItem";

        const link = document.createElement("span");
        link.className = "link";
        link.textContent = site;

        link.onclick = () => {
            urlInput.value = site;
            searchContainer.classList.remove("active");
        };

        const del = document.createElement("span");
        del.className = "deleteBtn";
        del.textContent = "x";
        del.onclick = e => {
           e.stopPropagation();
            deleteSite(index);
        };

        item.appendChild(link);
        item.appendChild(del);
        savedContainer.appendChild(item);
    });
}

displaySavedSites();

// =========================================================
//  WORKING SITE DETECTION (PAUSE + RESUME + LIVE UPDATE)
// =========================================================

function testSite(url) {
    return new Promise(resolve => {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;

        const timeout = setTimeout(() => {
            iframe.remove();
            resolve(false);
        }, 800);

        iframe.onload = () => {
            clearTimeout(timeout);
            iframe.remove();
            resolve(true);
        };

        iframe.onerror = () => {
            clearTimeout(timeout);
            iframe.remove();
            resolve(false);
        };

        document.body.appendChild(iframe);
    });
}

async function detectWorkingSites() {
    if (testingInProgress) return;

    testingInProgress = true;
    testingPaused = false;

    workingSites = [];
    testedCount = 0;

    const total = siteDB.length;
    const batchSize = 15;

    updateTstButton();

    workingContainer.innerHTML = "";

    for (let i = 0; i < total; i += batchSize) {

        if (testingPaused) {
            testingInProgress = false;
            return;
        }

        const batch = siteDB.slice(i, i + batchSize);

        const results = await Promise.all(
            batch.map(site =>
                testSite(site.url).then(ok => ({ url: site.url, ok }))
            )
        );

        results.forEach(r => {
            testedCount++;
            if (r.ok) {
                workingSites.push(r.url);
                addWorkingSiteToUI(r.url);
            }
        });

        updateTstButton();

        await new Promise(res => setTimeout(res, 50));
    }

    testingInProgress = false;
    updateTstButton(true);
}

function addWorkingSiteToUI(url) {
    const item = document.createElement("div");
    item.className = "savedItem";

    const link = document.createElement("span");
    link.className = "link";
    link.textContent = url;

    link.onclick = () => {
        urlInput.value = url;
        searchContainer.classList.remove("active");
    };

    item.appendChild(link);
    workingContainer.appendChild(item);
}

function updateTstButton(done = false) {
    const total = siteDB.length;

    if (done) {
        tstBtn.textContent = `tst (${testedCount}/${total})`;
        tstBtn.classList.remove("active");
        tstBtn.style.background = "#000";
        tstBtn.style.color = "#fff";
        return;
    }

    tstBtn.textContent = `tst (${testedCount}/${total})`;

    if (testingInProgress && !testingPaused) {
        tstBtn.classList.add("active");
        tstBtn.style.background = "#fff";
        tstBtn.style.color = "#000";
    } else {
        tstBtn.classList.remove("active");
        tstBtn.style.background = "#000";
        tstBtn.style.color = "#fff";
    }
}

// =========================================================
//  TST BUTTON (PAUSE / RESUME)
// =========================================================
tstBtn.onclick = () => {
    if (!testingInProgress) {
        detectWorkingSites();
    } else {
        testingPaused = !testingPaused;
        updateTstButton();

        if (!testingPaused) {
            detectWorkingSites();
        }
    }
};

// =========================================================
//  POPUP MODE (FIXED — NO WHITE OUTLINE)
// =========================================================
clckBtn.onclick = () => {
    const navUrl = location.origin + location.pathname;

    const popupHTML = `
        <style>
            html, body {
                margin: 0;
                padding: 0;
                background: #000;
                overflow: hidden;
            }
            iframe {
                width: 100vw;
                height: 100vh;
                border: none;
            }
        </style>
        <iframe src="${navUrl}"></iframe>
    `;

    if (popupMode === "about") {
        const win = window.open("about:blank", "_blank");
        if (win) {
            win.document.write(popupHTML);
            win.document.close();
        }
    } else {
        const blob = new Blob([popupHTML], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
    }
};

// =========================================================
//  POPUP BUTTONS
// =========================================================
vtprBtn.onclick = () => {
    let url = currentUrl || urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;

    if (popupMode === "about") window.open(url, "_blank");
    else {
        const blob = new Blob([`
            <style>
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #000;
                    overflow: hidden;
                }
                iframe {
                    width: 100vw;
                    height: 100vh;
                    border: none;
                }
            </style>
            <iframe src="${url}"></iframe>
        `], { type: "text/html" });

        window.open(URL.createObjectURL(blob), "_blank");
    }
};

// =========================================================
//  CLOSE MENU
// =========================================================
closeBtn.onclick = () => searchContainer.classList.remove("active");
