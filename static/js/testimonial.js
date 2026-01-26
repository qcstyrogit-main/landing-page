document.addEventListener("DOMContentLoaded", () => {
    const quoteEl = document.getElementById("testimonialQuote");
    const nameEl = document.getElementById("testimonialName");
    const roleEl = document.getElementById("testimonialRole");
    const ratingEl = document.getElementById("testimonialRating");
    const avatarEl = document.getElementById("testimonialAvatar");
    const prevBtn = document.getElementById("testimonialPrev");
    const nextBtn = document.getElementById("testimonialNext");

    if (!quoteEl || !nameEl || !roleEl || !ratingEl || !avatarEl) return;

    let testimonials = [];
    let index = 0;

    function initials(name) {
        return name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join("");
    }

    function renderStars(count) {
        const stars = [];
        const fullStars = Math.floor(count);
        const hasHalf = count - fullStars >= 0.5;
        for (let i = 0; i < 5; i += 1) {
            if (i < fullStars) {
                stars.push('<span class="star is-filled">★</span>');
            } else if (i === fullStars && hasHalf) {
                stars.push('<span class="star is-half">★</span>');
            } else {
                stars.push('<span class="star">★</span>');
            }
        }
        return stars.join("");
    }

    function render() {
        const item = testimonials[index];
        if (!item) return;
        quoteEl.innerHTML = item.quote;
        nameEl.textContent = item.name;
        roleEl.textContent = item.role;
        ratingEl.innerHTML = renderStars(item.rating || 0);
        if (item.avatar) {
            avatarEl.style.backgroundImage = `url("${item.avatar}")`;
            avatarEl.classList.add("has-image");
            avatarEl.textContent = "";
        } else {
            avatarEl.style.backgroundImage = "";
            avatarEl.classList.remove("has-image");
            avatarEl.textContent = initials(item.name);
        }
    }

    function next() {
        index = (index + 1) % testimonials.length;
        render();
    }

    function prev() {
        index = (index - 1 + testimonials.length) % testimonials.length;
        render();
    }

    prevBtn?.addEventListener("click", prev);
    nextBtn?.addEventListener("click", next);

    async function loadTestimonials() {
        try {
            const res = await fetch("/api/testimonials", { credentials: "include" });
            if (!res.ok) return;
            const payload = await res.json();
            const data = payload && payload.message ? payload.message : payload;
            const items = data.items || [];
            testimonials = items.map((item) => {
                let rating = Number(item.rating || 0);
                if (rating > 0 && rating <= 1) {
                    rating = rating * 5;
                }
                rating = Math.max(0, Math.min(5, rating));
                let quote = item.testimonial || "";
                quote = String(quote).replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "");
                return {
                    quote,
                    name: item.employee_name || "Employee",
                    role: item.employee_position || "",
                    rating,
                    avatar: item.employee_image || ""
                };
            });
            if (!testimonials.length) return;
            index = 0;
            render();
        } catch (err) {
            // silent fail
        }
    }

    loadTestimonials();
});
