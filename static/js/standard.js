document.addEventListener('DOMContentLoaded', () => {
    const slider = document.querySelector('.standard-slider'); 
    const track = document.querySelector('.slider-track');
    
    // Check if we are on a mobile screen and the elements exist
    if (window.innerWidth <= 600 && slider && track) {
        
        // --- A. Infinite Scroll Loop (Manual Correction) ---
        // This is necessary because the CSS animation resets instantly, 
        // but the manual scroll needs the position correction.
        
        // Assuming 4 unique images repeated once, making 8 total images.
        // The unique content width is 50% of the 200% track width.
        const uniqueContentWidth = track.scrollWidth / 2;

        slider.addEventListener('scroll', () => {
            const scrollLeft = slider.scrollLeft;

            // Loop Forwards: Jump back to the start of the unique set
            if (scrollLeft >= uniqueContentWidth) {
                slider.scrollLeft = scrollLeft - uniqueContentWidth;
            }
            
            // Loop Backwards: Jump forward to the start of the duplicate set
            if (scrollLeft <= 0) {
                slider.scrollLeft = scrollLeft + uniqueContentWidth;
            }
        });

        // Set initial scroll position to the start of the duplicate content
        // so the user can scroll both left and right immediately.
        setTimeout(() => {
             slider.scrollLeft = uniqueContentWidth; 
        }, 100);


        // --- B. Pause/Resume Animation on Interaction ---
        
        // Function to pause the animation
        const pauseScroll = () => {
            track.style.animationPlayState = 'paused';
        };

        // Function to resume the animation
        const resumeScroll = () => {
            // Check if the user is still scrolling or interacting before resuming
            // A small delay helps prevent immediate re-start after a quick tap
            setTimeout(() => {
                track.style.animationPlayState = 'running';
            }, 500); 
        };

        // Pause animation when the user touches/hovers over the slider
        slider.addEventListener('mouseover', pauseScroll); // Desktop hover check
        slider.addEventListener('touchstart', pauseScroll); // Mobile touch start

        // Resume animation when the user releases touch/stops hovering
        slider.addEventListener('mouseout', resumeScroll); // Desktop hover end
        slider.addEventListener('touchend', resumeScroll); // Mobile touch end
        
    }
});