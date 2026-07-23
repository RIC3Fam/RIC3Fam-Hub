import * as helpers from '../helpers.js';
import { groups, users, games } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import { usersData, gamesData, picturesData } from './index.js';
import xss from 'xss';

const normalizeSectionTitle = (value, fallback) => {
    return value && String(value).trim() ? xss(String(value).trim()) : fallback;
};

const normalizeOptionalLink = (url, desc, urlName, descName) => {
    if (url != null && String(url).trim() !== '') {
        const link = helpers.stringHelper(String(url), urlName);
        const linkdesc =
            desc != null && String(desc).trim() !== ''
                ? helpers.stringHelper(String(desc), descName, 1, 100)
                : '';
        return { link, linkdesc };
    }
    return { link: '', linkdesc: '' };
};

const normalizeProjectFramers = (framersInput) => {
    if (!framersInput) return [];
    let rows = framersInput;
    if (!Array.isArray(rows) && typeof rows === 'object') {
        rows = Object.keys(rows)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => rows[k]);
    }
    if (!Array.isArray(rows)) return [];

    const framers = [];
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const title = helpers.optionalString(row.title, 'Project framer title', 80);
        const userId = row.userId != null ? String(row.userId).trim() : '';
        if (!title && !userId) continue;
        if (!title) throw 'Each project framer needs a title';
        helpers.isValidId(userId);
        framers.push({ title, userId });
    }
    return framers;
};

const create = async (
    groupName,
    groupDescription,
    groupLeader,
    uppercaseTitle,
    lowercaseTitle,
    numericTitle,
    visibility = 'public',
    privateDescription = '',
    link1 = '',
    link1desc = '',
    link2 = '',
    link2desc = '',
    projectFramers = []
) => {
    // Input Validation
    helpers.validateGroup(groupName, groupDescription, groupLeader);

    groupName = groupName.trim();
    groupDescription = groupDescription.trim();

    // Default fallback values if fields were left blank in the form
    uppercaseTitle = normalizeSectionTitle(uppercaseTitle, 'All Caps Members');
    lowercaseTitle = normalizeSectionTitle(lowercaseTitle, 'Lowercase Members');
    numericTitle = normalizeSectionTitle(numericTitle, 'Numbered Members');
    visibility = helpers.normalizeVisibility(visibility);
    privateDescription = helpers.optionalString(privateDescription, 'Private description');
    const website = normalizeOptionalLink(link1, link1desc, 'Website URL', 'Website label');
    const social = normalizeOptionalLink(link2, link2desc, 'Social media URL', 'Social label');
    const framers = normalizeProjectFramers(projectFramers);

    // Add group to database
    let newgroup = {
        groupName: xss(groupName),
        description: xss(groupDescription),
        groupLeader,
        uppercaseTitle,
        lowercaseTitle,
        numericTitle,
        comments: [],
        players: [groupLeader],
        totalNumberOfPlayers: 1,
        groupImage: 'https://storage.googleapis.com/family-frisbee-media/icons/RIC3FamilyLogo.jpg',
        visibility,
        privateDescription,
        link1: website.link,
        link1desc: website.linkdesc,
        link2: social.link,
        link2desc: social.linkdesc,
        projectFramers: framers,
        slideshowImages: [],
        slideshowDescription: '',
    };
    const groupCollection = await groups();
    const insertInfo = await groupCollection.insertOne(newgroup);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) throw 'Could not add group';
    const newId = insertInfo.insertedId.toString();

    const userCollection = await users();
    const updateUser = await userCollection.updateOne({ _id: new ObjectId(groupLeader) }, { $push: { groups: newId } });
    if (!updateUser) throw 'Could not update user';

    const group = await groupCollection.findOne({ _id: new ObjectId(newId) });
    group._id = group._id.toString();
    return group;
};

const getIDName = async (groupIds) => {
    //Given an array of IDs return an array of objects, each object contains the id and the associated name
    let ret = [];
    for (let groupId of groupIds) {
        helpers.isValidId(groupId);
        groupId = groupId.trim();

        try {
            const group = await get(groupId);
            ret.push({ _id: groupId, name: group.groupName });
        } catch (e) {
            // In the case that a group is deleted, we skip
            continue;
        }
    }
    return ret;
};

const filterPrivateGroups = (groupList, viewerId = null) => {
    return groupList.filter((g) => {
        const vis = g.visibility === 'private' ? 'private' : 'public';
        if (vis !== 'private') return true;
        if (!viewerId) return false;
        if (g.groupLeader === viewerId) return true;
        return Array.isArray(g.players) && g.players.includes(viewerId);
    });
};

const getAll = async (viewerId = null) => {
    const groupCollection = await groups();
    let groupList = await groupCollection
        .find({})
        .project({ _id: 1, groupName: 1, visibility: 1, groupLeader: 1, players: 1 })
        .toArray();

    if (!groupList) throw 'Could not get all groups';
    groupList = filterPrivateGroups(groupList, viewerId);
    groupList = groupList.map((element) => {
        element._id = element._id.toString();
        if (element.visibility !== 'private') element.visibility = 'public';
        return element;
    });

    return groupList;
};

const getAllGroupsbyUserID = async (userId) => {
    helpers.isValidId(userId);
    userId = userId.trim();
    const groupCollection = await groups();
    let groupList = await groupCollection.find({}).project({ _id: 1, groupName: 1, players: 1 }).toArray();

    if (!groupList) throw 'Could not get all groups';
    groupList = groupList.map((element) => {
        element._id = element._id.toString();
        return element;
    });
    groupList = groupList.filter((group) => group.players.includes(userId));

    return groupList;
};

const get = async (groupId) => {
    // Input Validation
    helpers.isValidId(groupId);
    groupId = groupId.trim();

    // Get group with given id
    const groupCollection = await groups();
    const group = await groupCollection.findOne({ _id: new ObjectId(groupId) });

    if (group === null) throw 'No group with that id';
    group._id = group._id.toString();
    if (!Array.isArray(group.slideshowImages)) group.slideshowImages = [];
    if (group.slideshowDescription == null) group.slideshowDescription = '';
    if (!Array.isArray(group.projectFramers)) group.projectFramers = [];
    if (group.link1 == null) group.link1 = '';
    if (group.link1desc == null) group.link1desc = '';
    if (group.link2 == null) group.link2 = '';
    if (group.link2desc == null) group.link2desc = '';
    return helpers.withVisibilityDefaults(group);
};

const remove = async (groupId) => {
    // Input Validation
    helpers.isValidId(groupId);
    groupId = groupId.trim();

    // Delete group with given id
    const groupCollection = await groups();
    const deletionInfo = await groupCollection.findOneAndDelete(
        {
            _id: new ObjectId(groupId),
        },
        { returnDocument: 'after' }
    );

    if (!deletionInfo) {
        throw `Could not delete group with id of ${groupId}`;
    }
    const userCollection = await users();
    const userUpdateResult = await userCollection.updateMany({ groups: groupId }, { $pull: { groups: groupId } });
    if (!userUpdateResult) {
        throw 'Could not remove groupid from users';
    }
    const gameCollection = await games();
    const gameUpdateResult = await gameCollection.updateMany({ group: groupId }, { $set: { group: null } });
    if (!gameUpdateResult) {
        throw 'Could not remove groupid from game';
    }

    // Delete info from bucket
    await picturesData.deleteUserFolder(groupId);

    const res = { groupName: deletionInfo.groupName, deleted: true };

    return res;
};

const update = async (
    groupId,
    groupName,
    groupDescription,
    groupLeader,
    groupImage,
    visibility,
    privateDescription,
    uppercaseTitle,
    lowercaseTitle,
    numericTitle,
    link1,
    link1desc,
    link2,
    link2desc,
    projectFramers
) => {
    // Input Validation
    helpers.isValidId(groupId);
    groupId = groupId.trim();

    helpers.validateGroup(groupName, groupDescription, groupLeader);

    groupName = groupName.trim();
    groupDescription = groupDescription.trim();

    const oldGroup = await get(groupId); // Check if group exists

    const website =
        link1 !== undefined
            ? normalizeOptionalLink(link1, link1desc, 'Website URL', 'Website label')
            : { link: oldGroup.link1 || '', linkdesc: oldGroup.link1desc || '' };
    const social =
        link2 !== undefined
            ? normalizeOptionalLink(link2, link2desc, 'Social media URL', 'Social label')
            : { link: oldGroup.link2 || '', linkdesc: oldGroup.link2desc || '' };

    // Update record
    const updatedgroup = {
        groupName: xss(groupName),
        description: xss(groupDescription),
        groupLeader,
        uppercaseTitle:
            uppercaseTitle !== undefined
                ? normalizeSectionTitle(uppercaseTitle, oldGroup.uppercaseTitle || 'All Caps Members')
                : oldGroup.uppercaseTitle,
        lowercaseTitle:
            lowercaseTitle !== undefined
                ? normalizeSectionTitle(lowercaseTitle, oldGroup.lowercaseTitle || 'Lowercase Members')
                : oldGroup.lowercaseTitle,
        numericTitle:
            numericTitle !== undefined
                ? normalizeSectionTitle(numericTitle, oldGroup.numericTitle || 'Numbered Members')
                : oldGroup.numericTitle,
        comments: oldGroup.comments,
        players: oldGroup.players,
        totalNumberOfPlayers: oldGroup.totalNumberOfPlayers,
        groupImage: groupImage ? groupImage : oldGroup.groupImage,
        slideshowImages: oldGroup.slideshowImages || [],
        slideshowDescription: oldGroup.slideshowDescription || '',
        visibility: visibility != null ? helpers.normalizeVisibility(visibility) : oldGroup.visibility || 'public',
        privateDescription:
            privateDescription != null
                ? helpers.optionalString(privateDescription, 'Private description')
                : oldGroup.privateDescription || '',
        link1: website.link,
        link1desc: website.linkdesc,
        link2: social.link,
        link2desc: social.linkdesc,
        projectFramers:
            projectFramers !== undefined ? normalizeProjectFramers(projectFramers) : oldGroup.projectFramers || [],
    };

    const groupCollection = await groups();
    const updatedInfo = await groupCollection.findOneAndReplace({ _id: new ObjectId(groupId) }, updatedgroup, { returnDocument: 'after' });
    if (!updatedInfo) throw 'Could not update group successfully';

    updatedInfo._id = updatedInfo._id.toString();

    return updatedInfo;
};

const addComment = async (groupId, userId, comment) => {
    // Input Validation
    helpers.isValidId(groupId);
    helpers.isValidId(userId);
    groupId = groupId.trim();
    userId = userId.trim();

    if (!comment) throw 'Comment is not provided';
    if (typeof comment !== 'string') throw 'Comment is not a string';
    comment = comment.trim();
    if (comment.length === 0) throw 'Comment is all whitespace';

    const group = await get(groupId);
    if (!group.players.includes(userId)) throw 'Commenter is not in the group';

    // Update record
    const newComment = {
        _id: new ObjectId(),
        userId,
        timestamp: new Date(),
        commentText: xss(comment),
    };

    const groupCollection = await groups();
    const updatedInfo = await groupCollection.updateOne({ _id: new ObjectId(groupId) }, { $push: { comments: newComment } });

    if (!updatedInfo) throw 'Could not update group successfully';

    return updatedInfo;
};

const removeComment = async (groupId, commentId) => {
    helpers.isValidId(groupId);
    helpers.isValidId(commentId);
    groupId = groupId.trim();
    commentId = commentId.trim();

    const groupCollection = await groups();
    const removedComment = await groupCollection.updateOne({ _id: new ObjectId(groupId) }, { $pull: { comments: { _id: new ObjectId(commentId) } } });
    if (!removedComment) {
        throw 'Could not delete comment successfully';
    }

    return removedComment;
};

const addUser = async (userId, groupId) => {
    //Input validation
    helpers.isValidId(userId);
    helpers.isValidId(groupId);
    userId = userId.trim();
    groupId = groupId.trim();

    const group = await get(groupId);
    if (!group) {
        throw 'Could not find group';
    }
    if (group.maxCapacity <= group.players.length) {
        throw 'Game is full';
    }
    if (group.players.includes(userId)) {
        throw 'User is already in the group.';
    }
    const user = await usersData.getUser(userId);
    if (!user) {
        throw 'Could not find user';
    }

    //Update group collection
    const groupCollection = await groups();
    const userCollection = await users();
    const updateGame = await groupCollection.updateOne(
        { _id: new ObjectId(groupId) },
        {
            $push: { players: userId },
            $inc: { totalNumberOfPlayers: 1 },
        }
    );
    const updateUser = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $push: { groups: groupId } });

    if (!updateGame || !updateUser) {
        throw 'Could not update either game or user';
    }

    return { updateGame, updateUser };
};

const searchGroups = async (search, viewerId = null) => {
    //Returns the first 10 users that start with a search query
    let resultSize = 10;

    if (!search) {
        throw 'Most provide valid search term';
    }
    if (typeof search !== 'string') {
        throw 'Search term must be a valid string';
    }
    search = search.trim();
    if (search.length === 0) {
        throw 'Empty string is not valid';
    }

    const groupCollection = await groups();
    const reg = new RegExp(`${search}`, 'i'); // 'i' for case-insensitive
    let groupList = await groupCollection.find({ groupName: reg }).limit(resultSize).toArray();
    if (!groupList || groupList.length === 0) {
        throw "Couldn't find any groups with that name";
    }

    groupList = filterPrivateGroups(groupList, viewerId);
    groupList = groupList.map((element) => {
        element._id = element._id.toString();
        if (element.visibility !== 'private') element.visibility = 'public';
        return element;
    });

    return groupList;
};
const leaveGroup = async (userId, groupId) => {
    helpers.isValidId(userId);
    helpers.isValidId(groupId);
    const group = await get(groupId);
    const user = await usersData.getUser(userId);

    if (!group) throw 'Could not find group';
    if (!user) throw 'Could not find user';
    if (!group.players.includes(userId)) throw 'User is not a part of this group';
    if (!user.groups.includes(groupId)) throw 'User is not a part of this group';

    const groupCollection = await groups();
    const userCollection = await users();

    const updateUser = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $pull: { groups: groupId } });

    const updateGroup = await groupCollection.updateOne(
        { _id: new ObjectId(groupId) },
        {
            $pull: { players: userId },
            $inc: { totalNumberOfPlayers: -1 },
        }
    );
    if (updateUser.modifiedCount === 0 || updateGroup.modifiedCount === 0) {
        throw 'Could not update user or group';
    }

    return { updateUser, updateGroup };
};

const editGroupImage = async (groupId, imagePath) => {
    const group = await get(groupId);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';

    const url = `${base}/${bucketName}/${groupId}/${imagePath}`;
    await update(
        groupId,
        group.groupName,
        group.description,
        group.groupLeader,
        url,
        group.visibility,
        group.privateDescription,
        group.uppercaseTitle,
        group.lowercaseTitle,
        group.numericTitle,
        group.link1,
        group.link1desc,
        group.link2,
        group.link2desc,
        group.projectFramers
    );
};

/**
 *
 * @param {string} groupId
 * @param {string} imagePath - /type/imageName/imageNum
 * @returns {object}
 */
const addSlideshowImage = async (groupId, imagePath) => {
    helpers.isValidId(groupId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${groupId}/${imagePath}`;
    const slide = { url, caption: helpers.captionFromImageUrl(url) };

    const groupCollection = await groups();
    const updatedInfo = await groupCollection.updateOne(
        { _id: new ObjectId(groupId) },
        { $push: { slideshowImages: slide } }
    );

    if (!updatedInfo) throw 'Could not update group successfully';

    return updatedInfo;
};

const removeSlideshowImage = async (groupId, imagePath) => {
    helpers.isValidId(groupId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${groupId}/${imagePath}`;

    const group = await get(groupId);
    const next = helpers
        .normalizeSlideshowSlides(group.slideshowImages || [])
        .filter((slide) => slide.url !== url);

    const groupCollection = await groups();
    const updatedInfo = await groupCollection.updateOne(
        { _id: new ObjectId(groupId) },
        { $set: { slideshowImages: next } }
    );

    if (!updatedInfo) throw 'Could not update group successfully';

    return updatedInfo;
};

const updateSlideshowCaption = async (groupId, imageUrl, caption) => {
    helpers.isValidId(groupId);
    helpers.stringHelper(imageUrl, 'Image URL', 1, 2048);
    const nextCaption = helpers.optionalString(caption, 'Caption', 200);

    const group = await get(groupId);
    const slides = helpers.normalizeSlideshowSlides(group.slideshowImages || []);
    let found = false;
    const next = slides.map((slide) => {
        if (helpers.slideshowUrlsMatch(slide.url, imageUrl)) {
            found = true;
            return { url: slide.url, caption: nextCaption };
        }
        return slide;
    });
    if (!found) throw 'Slideshow image not found';

    const groupCollection = await groups();
    const updatedInfo = await groupCollection.updateOne(
        { _id: new ObjectId(groupId) },
        { $set: { slideshowImages: next } }
    );
    if (!updatedInfo) throw 'Could not update caption';
    return updatedInfo;
};

export default {
    create,
    leaveGroup,
    getAll,
    get,
    remove,
    update,
    addComment,
    addUser,
    searchGroups,
    getIDName,
    getAllGroupsbyUserID,
    removeComment,
    editGroupImage,
    addSlideshowImage,
    removeSlideshowImage,
    updateSlideshowCaption,
};
