// Photo gallery deletion. Uploads are handled by the existing upload form
// (addToSlideshow.handlebars + pictures.js), and the layout is pure CSS (a
// full-width grid that auto-fits as many pictures per row as fit the screen),
// so this file only wires up deletion of already-uploaded images.

const deleteButtons = document.querySelectorAll('.gallery-delete-button');

deleteButtons.forEach((button) => {
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
