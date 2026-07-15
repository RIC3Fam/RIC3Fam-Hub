(function () {
    const sliders = document.querySelectorAll('[data-slider]');
    if (!sliders.length) return;

    sliders.forEach((slider) => {
        const slides = Array.from(slider.querySelectorAll('.picture-slider-slide'));
        const dots = Array.from(slider.querySelectorAll('.picture-slider-dot'));
        const prevBtn = slider.querySelector('.picture-slider-prev');
        const nextBtn = slider.querySelector('.picture-slider-next');
        if (slides.length === 0) return;

        let index = 0;

        function show(i) {
            index = (i + slides.length) % slides.length;
            slides.forEach((slide, n) => {
                slide.classList.toggle('is-active', n === index);
            });
            dots.forEach((dot, n) => {
                dot.classList.toggle('is-active', n === index);
            });
        }

        if (prevBtn) prevBtn.addEventListener('click', () => show(index - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => show(index + 1));
        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const i = Number(dot.getAttribute('data-index'));
                if (!Number.isNaN(i)) show(i);
            });
        });

        if (slides.length > 1) {
            setInterval(() => show(index + 1), 6000);
        }
    });
})();
