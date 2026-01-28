document.addEventListener("DOMContentLoaded", () => {
    const slide = document.querySelector(".events-slide");
    const nextBtn = document.querySelector(".events-btn.next");
    const prevBtn = document.querySelector(".events-btn.prev");

    if (!slide) return;

    function rotateNext() {
        const items = slide.querySelectorAll(".event-item");
        if (items.length <= 1) return;
        slide.appendChild(items[0]);
    }

    function rotatePrev() {
        const items = slide.querySelectorAll(".event-item");
        if (items.length <= 1) return;
        slide.prepend(items[items.length - 1]);
    }

    nextBtn?.addEventListener("click", rotateNext);
    prevBtn?.addEventListener("click", rotatePrev);
});
