(() => {
    "use strict";

    const canvas = document.getElementById("siteField");
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0.5, y: 0.5, active: false };
    let width = 0;
    let height = 0;
    let ratio = 1;
    let particles = [];
    let animationFrame = 0;
    let lastTime = 0;

    const createParticle = (index, total) => {
        const accent = index === total - 1;
        return {
            x: Math.random(),
            y: Math.random(),
            depth: 0.25 + Math.random() * 0.75,
            size: accent ? 2.4 : 0.55 + Math.random() * 1.15,
            speedX: (Math.random() - 0.5) * 0.000018,
            speedY: (Math.random() - 0.5) * 0.000012,
            phase: Math.random() * Math.PI * 2,
            accent
        };
    };

    const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        const particleCount = Math.max(24, Math.min(58, Math.round(width / 28)));
        particles = Array.from({ length: particleCount }, (_, index) => createParticle(index, particleCount));
        draw(0, true);
    };

    const draw = (time, staticFrame = false) => {
        const lightTheme = document.documentElement.dataset.theme === "light";
        const delta = Math.min(time - lastTime || 16, 34);
        const scrollOffset = window.scrollY * 0.000035;
        lastTime = time;
        context.clearRect(0, 0, width, height);

        const points = particles.map((particle) => {
            if (!staticFrame && !reducedMotion.matches) {
                particle.x = (particle.x + particle.speedX * delta + 1) % 1;
                particle.y = (particle.y + particle.speedY * delta + 1) % 1;
                particle.phase += delta * 0.00028;
            }

            const pointerX = pointer.active ? (pointer.x - 0.5) * 34 * particle.depth : 0;
            const pointerY = pointer.active ? (pointer.y - 0.5) * 22 * particle.depth : 0;
            const x = particle.x * width + pointerX + Math.sin(particle.phase) * 7 * particle.depth;
            const y = ((particle.y + scrollOffset * particle.depth) % 1) * height + pointerY;
            return { ...particle, px: x, py: y };
        });

        points.forEach((point, index) => {
            if (point.accent) return;

            for (let next = index + 1; next < points.length; next += 1) {
                const other = points[next];
                if (other.accent) continue;
                const distance = Math.hypot(point.px - other.px, point.py - other.py);
                if (distance > 105) continue;

                context.beginPath();
                context.moveTo(point.px, point.py);
                context.lineTo(other.px, other.py);
                context.strokeStyle = lightTheme
                    ? `rgba(33, 54, 84, ${(1 - distance / 105) * 0.075})`
                    : `rgba(236, 231, 212, ${(1 - distance / 105) * 0.055})`;
                context.lineWidth = 0.6;
                context.stroke();
            }
        });

        points.forEach((point) => {
            context.beginPath();
            context.arc(point.px, point.py, point.size * point.depth, 0, Math.PI * 2);
            if (point.accent) {
                context.fillStyle = "rgba(229, 43, 53, 0.9)";
                context.shadowColor = "rgba(229, 43, 53, 0.65)";
                context.shadowBlur = 18;
            } else {
                context.fillStyle = lightTheme
                    ? `rgba(33, 54, 84, ${0.12 + point.depth * 0.24})`
                    : `rgba(236, 231, 212, ${0.18 + point.depth * 0.38})`;
                context.shadowColor = lightTheme
                    ? "rgba(33, 54, 84, 0.12)"
                    : "rgba(236, 231, 212, 0.2)";
                context.shadowBlur = 5;
            }
            context.fill();
            context.shadowBlur = 0;
        });

        if (!reducedMotion.matches && !staticFrame) {
            animationFrame = window.requestAnimationFrame(draw);
        }
    };

    const start = () => {
        window.cancelAnimationFrame(animationFrame);
        lastTime = performance.now();
        if (reducedMotion.matches) {
            draw(lastTime, true);
        } else {
            animationFrame = window.requestAnimationFrame(draw);
        }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX / Math.max(width, 1);
        pointer.y = event.clientY / Math.max(height, 1);
        pointer.active = true;
    }, { passive: true });
    document.addEventListener("mouseleave", () => {
        pointer.active = false;
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            window.cancelAnimationFrame(animationFrame);
        } else {
            start();
        }
    });
    reducedMotion.addEventListener("change", start);
    window.addEventListener("qcmc:themechange", start);

    resize();
    start();
})();
