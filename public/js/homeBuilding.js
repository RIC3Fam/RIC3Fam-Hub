(function () {
    const video = document.getElementById('home-billboard-video');
    const posterBtn = document.getElementById('home-billboard-poster-btn');
    if (!video) return;

    function showPoster() {
        if (!posterBtn) return;
        posterBtn.hidden = false;
        video.classList.remove('is-playing');
    }

    function hidePoster() {
        if (!posterBtn) return;
        posterBtn.hidden = true;
        video.classList.add('is-playing');
    }

    if (posterBtn) {
        posterBtn.addEventListener('click', () => {
            hidePoster();
            video.play().catch(() => showPoster());
        });
    }

    video.addEventListener('play', hidePoster);
    video.addEventListener('pause', () => {
        if (video.currentTime === 0 || video.ended) showPoster();
    });
    video.addEventListener('ended', () => {
        video.currentTime = 0;
        showPoster();
    });
})();
