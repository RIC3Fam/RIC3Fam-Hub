import { media } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import * as helpers from '../helpers.js';

const HOME_TITLE = 'Home Page Config';
const DEFAULT_BUILDING = '/public/images/home/building-base.png';
const LAYOUT_VERSION = 4;

// Percent positions for the mobile-portrait facade:
// - 2 square signs (uploadable art)
// - 3 custom link buttons on awnings / door-window
// Towel art stays painted in the base image (static).
const defaultHotspots = () => [
    { id: 'awning-left', label: 'Left awning', url: '', top: 61.5, left: 14.5, width: 22.0, height: 19.0 },
    { id: 'awning-center', label: 'Center door / window', url: '', top: 61.5, left: 38.0, width: 18.0, height: 19.0 },
    { id: 'awning-right', label: 'Right awning', url: '', top: 61.5, left: 58.0, width: 27.0, height: 19.0 },
];

const defaultBillboard = () => ({ top: 1.8, left: 19.5, width: 61.0, height: 10.5 });
const defaultTowel1 = () => ({ top: 41.0, left: 32.5, width: 13.5, height: 7.8, imageUrl: '', linkUrl: '' });
const defaultTowel2 = () => ({ top: 41.0, left: 52.0, width: 13.5, height: 7.8, imageUrl: '', linkUrl: '' });

const defaultHomeConfig = () => ({
    title: HOME_TITLE,
    layoutVersion: LAYOUT_VERSION,
    buildingImageUrl: DEFAULT_BUILDING,
    billboardVideoUrl: '',
    billboardPosterUrl: '',
    billboard: defaultBillboard(),
    towel1: defaultTowel1(),
    towel2: defaultTowel2(),
    hotspots: defaultHotspots(),
});

const clampPct = (value, fallback, min = 0, max = 100) => {
    if (value === '' || value == null) return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

const normalizeBox = (box, fallback) => {
    const src = box && typeof box === 'object' ? box : {};
    const base = fallback();
    return {
        top: clampPct(src.top, base.top),
        left: clampPct(src.left, base.left),
        width: clampPct(src.width, base.width, 1, 100),
        height: clampPct(src.height, base.height, 1, 100),
    };
};

const normalizeTowel = (towel, fallback) => {
    const src = towel && typeof towel === 'object' ? towel : {};
    const box = normalizeBox(src, fallback);
    return {
        ...box,
        imageUrl: helpers.optionalString(src.imageUrl, 'Towel image'),
        linkUrl: helpers.optionalString(src.linkUrl, 'Towel link'),
    };
};

const normalizeHotspots = (hotspotsInput) => {
    let rows = hotspotsInput;
    if (!Array.isArray(rows) && rows && typeof rows === 'object') {
        rows = Object.keys(rows)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => rows[k]);
    }
    if (!Array.isArray(rows)) return defaultHotspots();

    return rows.map((row, index) => {
        const fallback = defaultHotspots()[index] || defaultHotspots()[0];
        const id = helpers.optionalString(row?.id, 'Hotspot id', 60) || fallback.id;
        const label = helpers.optionalString(row?.label, 'Hotspot label', 120) || fallback.label;
        const url = helpers.optionalString(row?.url, 'Hotspot url', 2000);
        const top = clampPct(row?.top, fallback.top);
        const left = clampPct(row?.left, fallback.left);
        const width = clampPct(row?.width, fallback.width, 1, 100);
        const height = clampPct(row?.height, fallback.height, 1, 100);
        return { id, label, url, top, left, width, height };
    });
};

/** Keep saved URLs/images; refresh geometry from the current layout defaults. */
const applyLatestLayout = (doc) => {
    const defaults = defaultHomeConfig();
    const byId = Object.fromEntries((doc.hotspots || []).map((h) => [h.id, h]));
    const urlFor = (...ids) => {
        for (const id of ids) {
            if (byId[id]?.url) return byId[id].url;
        }
        return '';
    };
    return {
        ...defaults,
        buildingImageUrl: doc.buildingImageUrl || DEFAULT_BUILDING,
        billboardVideoUrl: doc.billboardVideoUrl || '',
        billboardPosterUrl: '',
        billboard: defaults.billboard,
        towel1: {
            ...defaults.towel1,
            imageUrl: doc.towel1?.imageUrl || '',
            linkUrl: '',
        },
        towel2: {
            ...defaults.towel2,
            imageUrl: doc.towel2?.imageUrl || '',
            linkUrl: '',
        },
        hotspots: defaults.hotspots.map((d) => ({
            ...d,
            url:
                d.id === 'awning-left'
                    ? urlFor('awning-left', 'creative-community')
                    : d.id === 'awning-right'
                      ? urlFor('awning-right', 'frisbee')
                      : urlFor('awning-center', 'ric3-fam', 'artists-residence'),
        })),
        layoutVersion: LAYOUT_VERSION,
    };
};

const withHomeDefaults = (doc) => {
    const base = defaultHomeConfig();
    if (!doc) return base;
    return {
        ...base,
        ...doc,
        layoutVersion: doc.layoutVersion || 0,
        buildingImageUrl: doc.buildingImageUrl || base.buildingImageUrl,
        billboardVideoUrl: doc.billboardVideoUrl || '',
        billboardPosterUrl: doc.billboardPosterUrl || '',
        billboard: normalizeBox(doc.billboard, defaultBillboard),
        towel1: normalizeTowel(doc.towel1, defaultTowel1),
        towel2: normalizeTowel(doc.towel2, defaultTowel2),
        hotspots: Array.isArray(doc.hotspots) && doc.hotspots.length ? normalizeHotspots(doc.hotspots) : base.hotspots,
    };
};

/**
 * Creates the default event page slideshow
 * @returns
 */
const createEventPageSlideshow = async () => {
    const slideshow = {
        _id: new ObjectId(),
        title: 'Event Page Slideshow',
        slideshowImages: [],
    };

    const mediaCollection = await media();

    const insertInfo = await mediaCollection.insertOne(slideshow);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) {
        throw 'Could not create event page slideshow';
    }

    return { insertSlideshow: true };
};

/**
 * Gets the default event page slideshow object.
 * Also purges blank/invalid URLs that render as empty slides.
 * @returns
 */
const getEventPageSlideshow = async () => {
    const mediaCollection = await media();

    const slideshow = await mediaCollection.findOne({ title: 'Event Page Slideshow' });
    if (!slideshow) throw 'Could not find event page slideshow';

    const raw = Array.isArray(slideshow.slideshowImages) ? slideshow.slideshowImages : [];
    // Drop blank / invalid entries that caused empty "ghost" slides.
    const cleanedUrls = raw
        .map((img) => (typeof img === 'string' ? img.trim() : img && img.url ? String(img.url).trim() : ''))
        .filter((url) => url && url !== 'undefined' && url !== 'null' && /^https?:\/\//i.test(url));

    if (cleanedUrls.length !== raw.length) {
        await mediaCollection.updateOne({ title: 'Event Page Slideshow' }, { $set: { slideshowImages: cleanedUrls } });
        slideshow.slideshowImages = cleanedUrls;
    }

    return slideshow;
};

/**
 * Adds an image to the event page slideshow
 * @param {string} imagePath - /type/imageName/imageNum
 * @returns {object}
 */
const addEventPageSlideshowImage = async (imagePath) => {
    console.log(`Adding ${imagePath}`);
    // Input Validation
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';

    const url = `${base}/${bucketName}/eventPage/${imagePath}`;

    // Update user info
    const mediaCollection = await media();
    const updatedInfo = await mediaCollection.updateOne({ title: 'Event Page Slideshow' }, { $push: { slideshowImages: url } });

    if (!updatedInfo) throw 'Could not update Event Page successfully';

    return updatedInfo;
};

/**
 * Removes an image from the event page slideshow
 * @param {string} imagePath - /type/imageName/imageNum
 * @returns {object}
 */
const removeEventPageSlideshowImage = async (imagePath) => {
    // Input Validation
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';

    const url = `${base}/${bucketName}/eventPage/${imagePath}`;

    // Update user info
    const mediaCollection = await media();
    const updatedInfo = await mediaCollection.updateOne({ title: 'Event Page Slideshow' }, { $pull: { slideshowImages: url } });

    if (!updatedInfo) throw 'Could not update Event Page successfully';

    return updatedInfo;
};

const createHomePageConfig = async () => {
    const mediaCollection = await media();
    const existing = await mediaCollection.findOne({ title: HOME_TITLE });
    if (existing) {
        if ((existing.layoutVersion || 0) < LAYOUT_VERSION) {
            return await updateHomePageConfig(applyLatestLayout(existing));
        }
        return withHomeDefaults(existing);
    }

    const doc = { _id: new ObjectId(), ...defaultHomeConfig() };
    const insertInfo = await mediaCollection.insertOne(doc);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) throw 'Could not create home page config';
    return withHomeDefaults(doc);
};

const getHomePageConfig = async () => {
    const mediaCollection = await media();
    let doc = await mediaCollection.findOne({ title: HOME_TITLE });
    if (!doc) {
        return await createHomePageConfig();
    }
    if ((doc.layoutVersion || 0) < LAYOUT_VERSION) {
        return await updateHomePageConfig(applyLatestLayout(doc));
    }
    return withHomeDefaults(doc);
};

const updateHomePageConfig = async (updates = {}) => {
    const mediaCollection = await media();
    let currentDoc = await mediaCollection.findOne({ title: HOME_TITLE });
    if (!currentDoc) {
        await createHomePageConfig();
        currentDoc = await mediaCollection.findOne({ title: HOME_TITLE });
    }
    const current = withHomeDefaults(currentDoc);

    const next = {
        title: HOME_TITLE,
        layoutVersion: updates.layoutVersion != null ? updates.layoutVersion : current.layoutVersion || LAYOUT_VERSION,
        buildingImageUrl:
            updates.buildingImageUrl != null
                ? helpers.optionalString(updates.buildingImageUrl, 'Building image') || DEFAULT_BUILDING
                : current.buildingImageUrl || DEFAULT_BUILDING,
        billboardVideoUrl:
            updates.billboardVideoUrl != null
                ? helpers.optionalString(updates.billboardVideoUrl, 'Billboard video')
                : current.billboardVideoUrl,
        billboardPosterUrl: '',
        billboard:
            updates.billboard != null
                ? normalizeBox({ ...current.billboard, ...updates.billboard }, defaultBillboard)
                : current.billboard,
        towel1:
            updates.towel1 != null
                ? normalizeTowel({ ...current.towel1, ...updates.towel1, linkUrl: '' }, defaultTowel1)
                : { ...current.towel1, linkUrl: '' },
        towel2:
            updates.towel2 != null
                ? normalizeTowel({ ...current.towel2, ...updates.towel2, linkUrl: '' }, defaultTowel2)
                : { ...current.towel2, linkUrl: '' },
        hotspots: updates.hotspots != null ? normalizeHotspots(updates.hotspots) : current.hotspots,
    };

    const result = await mediaCollection.findOneAndUpdate(
        { title: HOME_TITLE },
        { $set: next },
        { returnDocument: 'after', upsert: true }
    );
    if (!result) throw 'Could not update home page config';
    return withHomeDefaults(result);
};

const setHomeAssetUrl = async (field, imagePath) => {
    helpers.stringHelper(imagePath, 'Image Path', 1, 120);
    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/homePage/${imagePath}`;

    if (field === 'buildingImageUrl') return updateHomePageConfig({ buildingImageUrl: url });
    if (field === 'billboardVideoUrl') return updateHomePageConfig({ billboardVideoUrl: url });
    if (field === 'towel1Image') {
        const current = await getHomePageConfig();
        return updateHomePageConfig({ towel1: { ...current.towel1, imageUrl: url, linkUrl: '' } });
    }
    if (field === 'towel2Image') {
        const current = await getHomePageConfig();
        return updateHomePageConfig({ towel2: { ...current.towel2, imageUrl: url, linkUrl: '' } });
    }
    throw 'Unknown home asset field';
};

export default {
    createEventPageSlideshow,
    getEventPageSlideshow,
    addEventPageSlideshowImage,
    removeEventPageSlideshowImage,
    createHomePageConfig,
    getHomePageConfig,
    updateHomePageConfig,
    setHomeAssetUrl,
};
