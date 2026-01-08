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
});