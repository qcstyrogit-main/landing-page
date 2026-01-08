document.addEventListener("DOMContentLoaded", () => {
    const eventCardsContainer = document.querySelector('.events-cards');
    const eventWrapper = document.querySelector('.events-wrapper');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const eventCards = document.querySelectorAll('.events-cards .event-card');

    // ===========================
    // DUPLICATE CARDS (ONCE)
    // ===========================
    eventCards.forEach(card => {
        eventCardsContainer.appendChild(card.cloneNode(true));
    });

    let scrollSpeed = 0.5;
    let isDragging = false;
    let isPaused = false;
    let startX, scrollLeft;
    let halfScroll;

    // Calculate the reset point dynamically
    const updateDimensions = () => {
        halfScroll = eventCardsContainer.scrollWidth / 2;
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // ===========================
    // NORMALIZE SCROLL (KEY FIX)
    // ===========================
    const normalizeScroll = () => {
        if (eventCardsContainer.scrollLeft < 0) {
            eventCardsContainer.scrollLeft += halfScroll;
        } else if (eventCardsContainer.scrollLeft >= halfScroll) {
            eventCardsContainer.scrollLeft -= halfScroll;
        }
    };

    // ===========================
    // AUTO SCROLL (INFINITE)
    // ===========================
    const animate = () => {
        if (!isDragging && !isPaused) {
            eventCardsContainer.scrollLeft += scrollSpeed;
            normalizeScroll();
        }
        requestAnimationFrame(animate);
    };
    animate();

    // ===========================
    // NAVIGATION BUTTONS
    // ===========================
    const moveSlider = (direction) => {
        const cardWidth = eventCards[0].offsetWidth + 20; // width + gap
        eventCardsContainer.scrollLeft += direction * cardWidth;
        normalizeScroll();
    };

    prevBtn?.addEventListener('click', () => moveSlider(-1));
    nextBtn?.addEventListener('click', () => moveSlider(1));

    // ===========================
    // DRAG & SWIPE SUPPORT
    // ===========================
    const startDrag = (e) => {
        isDragging = true;
        startX = (e.pageX || e.touches[0].pageX);
        scrollLeft = eventCardsContainer.scrollLeft;
        eventCardsContainer.classList.add('dragging');
    };

    const handleMove = (e) => {
        if (!isDragging) return;
        const x = (e.pageX || e.touches[0].pageX);
        const walk = x - startX;
        eventCardsContainer.scrollLeft = scrollLeft - walk;
        normalizeScroll();
    };

    const stopDrag = () => {
        isDragging = false;
        eventCardsContainer.classList.remove('dragging');
    };

    eventCardsContainer.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopDrag);

    eventCardsContainer.addEventListener('touchstart', startDrag);
    eventCardsContainer.addEventListener('touchmove', handleMove);
    eventCardsContainer.addEventListener('touchend', stopDrag);

    // ===========================
    // HOVER PAUSE
    // ===========================
    eventWrapper.addEventListener('mouseenter', () => isPaused = true);
    eventWrapper.addEventListener('mouseleave', () => isPaused = false);
});