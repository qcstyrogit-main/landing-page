document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const form = document.getElementById("packagingFinderForm");
    const application = document.getElementById("finderApplication");
    const material = document.getElementById("finderMaterial");
    const format = document.getElementById("finderFormat");
    const submit = form?.querySelector(".packaging-finder-submit");
    const status = document.getElementById("packagingFinderStatus");

    if (!form || !application || !material || !format || !submit) return;

    const formats = {
        "food-service": [
            ["plastic", "Microwavable trays", "/products_plastic", "microwavable-tray"],
            ["plastic", "Salad trays & covers", "/products_plastic", "salad-trays-cover"],
            ["plastic", "Sauce cups", "/products_plastic", "sauce-cups"],
            ["styro", "Chicken boxes", "/products_styro", "chicken-box"],
            ["styro", "Hamburger boxes", "/products_styro", "hamburger-box"],
            ["styro", "Hotdog boxes", "/products_styro", "hotdog-box"],
            ["styro", "Lunch packs", "/products_styro", "lunch-packs"],
            ["styro", "Spaghetti boxes", "/products_styro", "spaghetti-box"]
        ],
        "dinnerware": [
            ["plastic", "Kubyertos", "/products_plastic", "kubyertos"],
            ["plastic", "PP bowls", "/products_plastic", "pp-bowl"],
            ["plastic", "Traditional cups", "/products_plastic", "traditional-cups"],
            ["plastic", "PET cups", "/products_plastic", "pet-cups"],
            ["styro", "EPS & PSP bowls", "/products_styro", "eps-psp-bowl"],
            ["styro", "Plates", "/products_styro", "plates"],
            ["styro", "Styrocups", "/products_styro", "styrocup"],
            ["styro", "Noodle cups", "/products_styro", "noodle-cup"]
        ],
        "industrial": [
            ["styro", "Industrial packaging", "/products_styro", "industrial"],
            ["plastic", "Plastic trays", "/products_plastic", "plastic-tray"],
            ["plastic", "Egg trays", "/products_plastic", "egg-tray"]
        ],
        "transport": [
            ["styro", "Coolers", "/products_styro", "cooler"],
            ["styro", "Industrial protection", "/products_styro", "industrial"],
            ["styro", "Trays", "/products_styro", "tray"],
            ["plastic", "Lids", "/products_plastic", "lids"]
        ]
    };

    const createChoiceControl = (select, includeEmpty = false) => {
        select.classList.add("finder-select-native");
        const choices = document.createElement("div");
        choices.className = "finder-choice-list";
        select.insertAdjacentElement("afterend", choices);

        const refresh = () => {
            choices.replaceChildren();
            Array.from(select.options).filter(option => option.value || includeEmpty).forEach(option => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = option.textContent;
                button.disabled = select.disabled || option.disabled;
                button.classList.toggle("is-selected", option.value === select.value);
                button.setAttribute("aria-pressed", String(option.value === select.value));
                button.addEventListener("click", () => {
                    select.value = option.value;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                    refresh();
                    document.activeElement?.blur();
                });
                choices.appendChild(button);
            });
        };

        refresh();
        return { refresh };
    };

    const applicationChoices = createChoiceControl(application);
    const materialChoices = createChoiceControl(material, true);
    const formatChoices = createChoiceControl(format);

    const renderFormats = () => {
        const selectedApplication = application.value;
        const selectedMaterial = material.value;
        const available = (formats[selectedApplication] || []).filter(
            item => !selectedMaterial || item[0] === selectedMaterial
        );

        format.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = selectedApplication
            ? (available.length ? "Select format" : "No matching formats")
            : "Choose an application first";
        format.appendChild(placeholder);

        available.forEach(([itemMaterial, label, path, category]) => {
            const option = document.createElement("option");
            option.value = `${path}|${category}`;
            option.textContent = `${label} / ${itemMaterial === "plastic" ? "Plasticware" : "Styroware"}`;
            format.appendChild(option);
        });

        format.disabled = !available.length;
        submit.disabled = true;
        applicationChoices.refresh();
        materialChoices.refresh();
        formatChoices.refresh();
        status.textContent = available.length
            ? `${available.length} matching format${available.length === 1 ? "" : "s"} available.`
            : "";
    };

    application.addEventListener("change", renderFormats);
    material.addEventListener("change", renderFormats);
    format.addEventListener("change", () => {
        submit.disabled = !format.value;
        formatChoices.refresh();
    });

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (!format.value) return;
        const [path, category] = format.value.split("|");
        window.location.assign(`${path}?category=${encodeURIComponent(category)}`);
    });
});
