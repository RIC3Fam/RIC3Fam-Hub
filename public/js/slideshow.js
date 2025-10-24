// JavaScript code to handle the add and delete buttons and the slideshow functionality
var deleteButtons = document.querySelectorAll('.delete-image-button');
//var addButton = document.querySelector('.add-image-button');
var images = document.querySelectorAll('.slideshow-image');
const imageContainers = document.querySelectorAll('.slideshow-image-container');
var currentIndex = 0;

// Handle delete buttons
deleteButtons.forEach(function (button, index) {
    button.addEventListener('click', async function () {
        // Remove image from slideshow
        try {
            await handleDeletion(images[index].src);
            setMessage('Successfully deleted image');
        } catch (err) {
            console.log(err);
            setError(err);
            return;
        }

        images[index].parentElement.remove();
        images = document.querySelectorAll('.slideshow-image');

        if (currentIndex >= images.length) {
            currentIndex = 0;
        }
    });
});

async function handleDeletion(fullImagePath) {
    const filename = fullImagePath.split('/').pop();

    // Check to see if this is the event page
    let isEventPage = document.getElementById('is-event-page');
    if (typeof isEventPage != 'undefined' && isEventPage != null) {
        isEventPage = true;
    } else {
        isEventPage = false;
    }

    console.log(filename);
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
    rotateImages();

    return response;
}

function nextImage() {
    if (imageContainers.length > 0) {
        imageContainers[currentIndex].style.display = 'none';
        currentIndex = (currentIndex + 1) % images.length;
        imageContainers[currentIndex].style.display = 'block';
    }
}

function previousImage() {
    if (imageContainers.length > 0) {
        imageContainers[currentIndex].style.display = 'none';
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        imageContainers[currentIndex].style.display = 'block';
    }
}

// Handle slideshow functionality
function rotateImages() {
    // Hide all images
    if (imageContainers.length > 0) {
        imageContainers.forEach(function (image) {
            image.style.display = 'none';
        });
    }

    // Move to next image
    nextImage();
}

if (images) {
    rotateImages();
    //setInterval(rotateImages, 10 * 1000); // Rotate images every 10 seconds
}
