document.addEventListener("DOMContentLoaded", function() {
    const layers = document.querySelectorAll('.fade-in-layer');

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if(entry.isIntersecting){
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    layers.forEach(layer => observer.observe(layer));

    const slides = document.querySelectorAll(".sustainability-slide");
    const tabs = document.querySelectorAll(".sustainability-pagination-tab");
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
