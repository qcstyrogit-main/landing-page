document.addEventListener("DOMContentLoaded", function() {
    const images = document.querySelectorAll(".intro-images img");
    let current = 0;

    setInterval(() => {
        images[current].style.opacity = 0; // hide current
        current = (current + 1) % images.length;
        images[current].style.opacity = 1; // show next
    }, 3000); // change image every 3 seconds
});
