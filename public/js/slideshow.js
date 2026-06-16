// Photo gallery behaviour:
//   - each picture gets a caption (derived from its filename for now),
//   - click a caption to expand/collapse it at the bottom of the picture,
//   - double-click a picture to enlarge it in a lightbox with the caption below,
//   - owner/admin delete (unchanged).
// Uploads are handled by the existing upload form (addToSlideshow + pictures.js).

// Turn an image URL into a human-ish caption: drop the path/extension and
// replace separators with spaces. (Placeholder until captions are stored.)
function captionFromUrl(url) {
    try {
        const file = decodeURIComponent(url.split('/').pop().split('?')[0]);
        const base = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        return base || 'Untitled';
    } catch (e) {
        return 'Untitled';
    }
}

const lightbox = document.getElementById('gallery-lightbox');
const lightboxImg = lightbox ? lightbox.querySelector('.gallery-lightbox-image') : null;
const lightboxCap = lightbox ? lightbox.querySelector('.gallery-lightbox-caption') : null;
const lightboxClose = lightbox ? lightbox.querySelector('.gallery-lightbox-close') : null;

function openLightbox(src, caption) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxCap.textContent = caption;
    lightbox.hidden = false;
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = '';
}

if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox(); // click outside the image
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

document.querySelectorAll('.gallery-item').forEach((item) => {
    const img = item.querySelector('.gallery-image');
    const caption = item.querySelector('.gallery-caption');
    if (!img) return;

    const text = captionFromUrl(img.src);
    if (caption) {
        caption.textContent = text;
        // Click the caption -> expand/collapse it at the bottom of the picture.
        caption.addEventListener('click', (e) => {
            e.stopPropagation();
            item.classList.toggle('caption-open');
        });
    }

    // Double-click the picture -> enlarge it with the caption on the bottom.
    img.addEventListener('dblclick', () => openLightbox(img.src, text));
});

// --- Image deletion ---
document.querySelectorAll('.gallery-delete-button').forEach((button) => {
    button.addEventListener('click', async () => {
        const item = button.closest('.gallery-item');
        const img = item ? item.querySelector('.gallery-image') : null;
        if (!img) return;

        try {
            await handleDeletion(img.src);
            setMessage('Successfully deleted image');
            item.remove();
        } catch (err) {
            console.log(err);
            setError(err);
        }
    });
});

async function handleDeletion(fullImagePath) {
    const filename = fullImagePath.split('/').pop();

    // Presence of the hidden #is-event-page marker means we're on the event page.
    const isEventPage = document.getElementById('is-event-page') != null;

    const response = await fetch('/pictures/slideshow', {
        mode: 'cors',
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename: filename,
            isEventPage: isEventPage,
        }),
    });

    return response;
}
