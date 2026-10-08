(() => {
    "use strict";

    const bubble = document.getElementById("chat-bubble");
    const mascot = bubble?.querySelector(".chat-mascot");
    const speech = bubble?.querySelector(".chat-mascot-speech");
    const rig = bubble?.querySelector(".chat-mascot-rig");
    const actionMenu = document.getElementById("chat-mascot-menu");
    const actionButtons = Array.from(actionMenu?.querySelectorAll("[data-mascot-action]") || []);
    if (!bubble || !mascot || !speech || !rig || !actionMenu || !actionButtons.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const visualStates = new Set(["idle", "studying", "eating", "sleeping"]);
    const actionDurations = {
        idle: [7000, 12000],
        studying: [8000, 12000],
        eating: [4500, 7000],
        sleeping: [10000, 15000],
        wave: [1400, 2000],
        bounce: [1400, 2200],
        talk: [3200, 5200]
    };
    const speechMessages = [
        "Need help?",
        "I'm still here!",
        "Click me 👋",
        "Looking for something?",
        "How can I help?"
    ];

    let actionTimer = 0;
    let currentAction = "idle";
    let currentVisualState = "idle";
    let lastInteraction = Date.now();
    let pointerFrame = 0;
    let randomMode = true;

    const randomBetween = ([minimum, maximum]) =>
        Math.round(minimum + Math.random() * (maximum - minimum));

    const isChatOpen = () => bubble.getAttribute("aria-expanded") === "true";

    const showVisualState = (state) => {
        if (!visualStates.has(state) || state === currentVisualState) return;
        currentVisualState = state;
    };

    const hideSpeech = () => {
        speech.classList.remove("is-visible");
    };

    const showSpeech = () => {
        const message = speechMessages[Math.floor(Math.random() * speechMessages.length)];
        speech.textContent = message;
        speech.classList.add("is-visible");
    };

    const stopActions = () => {
        window.clearTimeout(actionTimer);
        actionTimer = 0;
    };

    const availableActions = () => {
        const actions = [
            "idle", "idle", "idle", "idle", "idle",
            "studying", "studying",
            "wave"
        ];
        const inactiveFor = Date.now() - lastInteraction;
        const localHour = new Date().getHours();
        if (inactiveFor > 60000 || localHour >= 22 || localHour < 6) {
            actions.push("sleeping", "sleeping");
        }
        return actions;
    };

    const chooseNextAction = () => {
        const actions = availableActions().filter((action) => action !== currentAction);
        return actions[Math.floor(Math.random() * actions.length)] || "idle";
    };

    const scheduleNextAction = (delay) => {
        stopActions();
        if (!randomMode || document.hidden || isChatOpen() || reducedMotion.matches) return;

        actionTimer = window.setTimeout(() => {
            performAction(chooseNextAction());
        }, delay ?? randomBetween(actionDurations[currentAction]));
    };

    const performAction = (action) => {
        if (!actionDurations[action]) action = "idle";
        currentAction = action;
        hideSpeech();

        const visualState = visualStates.has(action) ? action : "idle";
        showVisualState(visualState);
        bubble.dataset.mascotState = action;

        if (action === "talk") showSpeech();
        scheduleNextAction(randomBetween(actionDurations[action]));
    };

    const closeActionMenu = ({ restoreFocus = false } = {}) => {
        if (actionMenu.hidden) return;
        actionMenu.hidden = true;
        actionMenu.setAttribute("aria-hidden", "true");
        if (restoreFocus) bubble.focus();
    };

    const openActionMenu = (clientX, clientY) => {
        actionMenu.hidden = false;
        actionMenu.setAttribute("aria-hidden", "false");
        actionMenu.style.left = "0px";
        actionMenu.style.top = "0px";

        const bounds = actionMenu.getBoundingClientRect();
        const gutter = 10;
        const left = Math.max(gutter, Math.min(clientX, window.innerWidth - bounds.width - gutter));
        const top = Math.max(gutter, Math.min(clientY, window.innerHeight - bounds.height - gutter));
        actionMenu.style.left = `${left}px`;
        actionMenu.style.top = `${top}px`;
        actionButtons[0].focus();
    };

    const wakeMascot = () => {
        lastInteraction = Date.now();
        if (currentAction === "sleeping") {
            performAction("wave");
        }
    };

    const syncActivity = () => {
        closeActionMenu();
        if (isChatOpen()) {
            stopActions();
            hideSpeech();
            currentAction = "idle";
            bubble.dataset.mascotState = "idle";
            showVisualState("idle");
            return;
        }
        scheduleNextAction(2200);
    };

    ["pointerdown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
        window.addEventListener(eventName, wakeMascot, { passive: true });
    });

    bubble.addEventListener("pointerdown", () => {
        bubble.classList.remove("is-click-reacting");
        void bubble.offsetWidth;
        bubble.classList.add("is-click-reacting");
        window.setTimeout(() => bubble.classList.remove("is-click-reacting"), 420);
    });

    bubble.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        lastInteraction = Date.now();
        openActionMenu(event.clientX, event.clientY);
    });

    actionMenu.addEventListener("click", (event) => {
        const button = event.target.closest("[data-mascot-action]");
        if (!button) return;

        const action = button.dataset.mascotAction;
        actionButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
        closeActionMenu();
        lastInteraction = Date.now();

        if (action === "random") {
            randomMode = true;
            performAction("wave");
            return;
        }

        randomMode = false;
        stopActions();
        performAction(action);
    });

    actionMenu.addEventListener("keydown", (event) => {
        const currentIndex = actionButtons.indexOf(document.activeElement);
        if (event.key === "Escape") {
            event.preventDefault();
            closeActionMenu({ restoreFocus: true });
            return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = (currentIndex + direction + actionButtons.length) % actionButtons.length;
        actionButtons[nextIndex].focus();
    });

    document.addEventListener("pointerdown", (event) => {
        if (actionMenu.hidden || actionMenu.contains(event.target) || bubble.contains(event.target)) return;
        closeActionMenu();
    });

    window.addEventListener("scroll", () => closeActionMenu(), { passive: true });

    window.addEventListener("pointermove", (event) => {
        if (!finePointer.matches || reducedMotion.matches || isChatOpen()) return;
        wakeMascot();
        if (pointerFrame) return;

        pointerFrame = window.requestAnimationFrame(() => {
            pointerFrame = 0;
            const bounds = rig.getBoundingClientRect();
            const eyeCenterX = bounds.left + (bounds.width * 0.5);
            const eyeCenterY = bounds.top + (bounds.height * 0.36);
            const deltaX = event.clientX - eyeCenterX;
            const deltaY = event.clientY - eyeCenterY;
            const distance = Math.hypot(deltaX, deltaY) || 1;
            const travel = Math.min(2.8, distance * 0.028);
            const horizontal = (deltaX / distance) * travel;
            const vertical = (deltaY / distance) * travel;

            mascot.style.setProperty("--mascot-look-x", `${horizontal.toFixed(2)}px`);
            mascot.style.setProperty("--mascot-look-y", `${vertical.toFixed(2)}px`);
        });
    }, { passive: true });

    const centerEyes = () => {
        mascot.style.setProperty("--mascot-look-x", "0px");
        mascot.style.setProperty("--mascot-look-y", "0px");
    };

    document.documentElement.addEventListener("pointerleave", centerEyes);
    window.addEventListener("blur", centerEyes);

    new MutationObserver(syncActivity).observe(bubble, {
        attributes: true,
        attributeFilter: ["aria-expanded"]
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopActions();
        else syncActivity();
    });

    reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches) {
            stopActions();
            hideSpeech();
            performAction("idle");
        } else {
            performAction("wave");
        }
    });

    window.setTimeout(() => performAction("wave"), 650);
})();
