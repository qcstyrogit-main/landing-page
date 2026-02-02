document.addEventListener("DOMContentLoaded", function () {
    const slides = document.querySelectorAll(".products-slide");
    const tabs = document.querySelectorAll(".products-pagination-tab");
    if (!slides.length) return;

    let currentSlide = 0;

    function showSlide(index) {
        slides[currentSlide].classList.remove("active");
        tabs[currentSlide]?.classList.remove("active");
        slides[index].classList.add("active");
        tabs[index]?.classList.add("active");
        currentSlide = index;
    }

    function nextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            showSlide(index);
        });
    });

    showSlide(currentSlide);
    setInterval(nextSlide, 5000);
});
