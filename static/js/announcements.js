document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".announcements-tab");
    const panels = document.querySelectorAll(".announcements-panel");
    const announcementList = document.getElementById("announcementList");
    const birthdayList = document.getElementById("birthdayList");
    const anniversaryList = document.getElementById("anniversaryList");
    if (!tabs.length || !panels.length) return;

    function setActive(targetId) {
        tabs.forEach((tab) => {
            const isActive = tab.getAttribute("aria-controls") === targetId;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.id === targetId);
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("aria-controls");
            if (targetId) {
                setActive(targetId);
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });

    function renderCards(container, items, emptyText, options = {}) {
        if (!container) return;
        container.innerHTML = "";
        if (!items || !items.length) {
            container.innerHTML = `<p>${emptyText}</p>`;
            return;
        }
        items.forEach((item) => {
            const name = item.employee_name || "Employee";
            const department = item.department || "Department";
            const designation = item.designation || "Designation";
            const date = item.date || "";
            const card = document.createElement("div");
            card.className = "announcement-card";
            let titleHtml = `<h3>${name}</h3>`;
            if (options.titleHtml) {
                titleHtml = options.titleHtml(name);
            }
            card.innerHTML = `
                ${titleHtml}
                <p>${department} • ${designation}</p>
                <div class="meta">${date}</div>
            `;
            container.appendChild(card);
        });
    }

    async function loadCelebrations() {
        if (!birthdayList || !anniversaryList) return;
        const now = new Date();
        const month = now.getMonth() + 1;
        try {
            const res = await fetch(`/api/employee-celebrations?month=${month}`, { credentials: "include" });
            if (!res.ok) {
                renderCards(birthdayList, [], "No birthdays to celebrate this month.");
                renderCards(anniversaryList, [], "No work anniversaries this month.");
                return;
            }
            const payload = await res.json();
            const data = payload && payload.message ? payload.message : payload;
            const birthdayTitle = (name) => {
                const greeting = "HAPPY BIRTHDAY".split("").map((ch) => {
                    if (ch === " ") return " ";
                    const color = `hsl(${Math.floor(Math.random() * 360)}, 75%, 55%)`;
                    return `<span style="color:${color}">${ch}</span>`;
                }).join("");
                return `
                    <div class="birthday-layout">
                        <div class="birthday-left">
                            <div class="birthday-name">${name}</div>
                        </div>
                        <div class="birthday-right">
                            <h3 class="birthday-title">
                                <svg class="birthday-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 2c-1.4 0-2.5 1.3-2.5 2.9 0 1.2.7 2.2 1.8 2.7.7.3 1.5.3 2.2 0 1.1-.5 1.8-1.5 1.8-2.7C15.3 3.3 13.9 2 12 2z" fill="currentColor"/>
                                    <path d="M5 10h14a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1-6 0 3 3 0 0 1-3 3 3 3 0 0 1-3-3v-1a2 2 0 0 1 2-2z" fill="currentColor"/>
                                    <path d="M6 16h12v6H6z" fill="currentColor"/>
                                </svg>
                                <span class="birthday-greeting">${greeting}</span>
                            </h3>
                        </div>
                    </div>
                `;
            };
            renderCards(
                birthdayList,
                data.birthdays || [],
                "No birthdays to celebrate this month.",
                { titleHtml: birthdayTitle }
            );
            renderCards(anniversaryList, data.anniversaries || [], "No work anniversaries this month.");
        } catch (err) {
            renderCards(birthdayList, [], "No birthdays to celebrate this month.");
            renderCards(anniversaryList, [], "No work anniversaries this month.");
        }
    }

    async function loadAnnouncements() {
        if (!announcementList) return;
        try {
            const res = await fetch("/api/announcements?limit=10&start=0", { credentials: "include" });
            if (!res.ok) {
                renderCards(announcementList, [], "No announcements right now.");
                return;
            }
            const payload = await res.json();
            const data = payload && payload.message ? payload.message : payload;
            const items = (data.items || []).slice().sort((a, b) => {
                const pa = Number(a.priority || 0);
                const pb = Number(b.priority || 0);
                if (pa !== pb) return pa - pb;
                const da = Date.parse(a.modified || 0) || 0;
                const db = Date.parse(b.modified || 0) || 0;
                return db - da;
            });
            if (!items.length) {
                renderCards(announcementList, [], "No announcements right now.");
                return;
            }
            announcementList.innerHTML = "";
            items.forEach((item) => {
                const card = document.createElement("div");
                card.className = "announcement-card";
                const image = item.image
                    ? `<div class="announcement-image"><img src="${item.image}" alt="Announcement image" loading="lazy"></div>`
                    : "";
                const body = item.announcement || "";
                card.innerHTML = `
                    ${image}
                    <div class="announcement-body">${body}</div>
                `;
                announcementList.appendChild(card);
            });
        } catch (err) {
            renderCards(announcementList, [], "No announcements right now.");
        }
    }

    loadAnnouncements();
    loadCelebrations();
});
