import { Storage } from '@google-cloud/storage';

let storage;
if (process.env.SECRET_KEY) {
    // If running locally
    //console.log('Getting local secret key');
    const project = process.env.PROJECT_ID;
    storage = new Storage({
        projectId: project,
        keyFilename: process.env.SECRET_KEY,
    });
} else {
    // Running on GCP
    //console.log('Using ADC');
    storage = new Storage();
}

/**
 * Generates a signed url for uploading an image to the GCP bucket
 * @param {string} user
 * @param {string} filename
 * @param {string} type
 * @returns
 */
const generateUploadSignedUrl = async (id, filename, type, contentType = 'image/jpeg') => {
    const bucketName = process.env.BUCKET_NAME;

    // These options will allow temporary uploading of the file
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
        contentType: contentType || 'image/jpeg',
    };

    // Get a signed URL for uploading file
    const [url] = await storage.bucket(bucketName).file(`${id}/${type}/${filename}`).getSignedUrl(options);

    console.log('Generated signed URL');
    //console.log(url);

    return url;
};

/**
 *
 * @param {string} filename It is either the default or the url of the stored image
 */
const deleteImageFromBucket = async (filename) => {
    const BUCKET_NAME = process.env.BUCKET_NAME;

    // Delete the file
    if (!undeletables.includes(filename)) {
        filename = filename.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, '');
        await storage.bucket(BUCKET_NAME).file(filename).delete();
    }
};

const deleteUserFolder = async (userId) => {
    const BUCKET_NAME = process.env.BUCKET_NAME;

    // Delete the file
    await storage.bucket(BUCKET_NAME).deleteFiles({
        prefix: userId,
    });
};

// Files that cannot be deleted bc they are critical
const undeletables = [
    'https://storage.googleapis.com/family-frisbee-media/icons/RIC3FAM.jpg',
    'https://storage.googleapis.com/family-frisbee-media/icons/Full_court.png',
    'https://storage.googleapis.com/family-frisbee-media/icons/RIC3FamilyLogo.jpg',
];
export default { generateUploadSignedUrl, deleteImageFromBucket, deleteUserFolder };
