import * as helpers from '../helpers.js';
import { games, users } from '../config/mongoCollections.js';
import { usersData, groupsData, picturesData } from './index.js';
import { ObjectId } from 'mongodb';
import xss from 'xss';

const formatAndValidateGame = function (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer = undefined, link, linkdesc) {
    gameName = helpers.stringHelper(gameName, 'Event name', 5, null);
    gameDescription = helpers.stringHelper(gameDescription, 'Event description', 1, null);
    gameDate = helpers.stringHelper(gameDate, 'Event date', 1, null);
    startTime = helpers.stringHelper(startTime, 'Start time', 1, null);
    endTime = helpers.stringHelper(endTime, 'End time', 1, null);

    //if (link != ""){ linkdesc = helpers.stringHelper(linkdesc, 'Link Description', 1, 300); }

    if (!helpers.isValidDay(gameDate)) throw 'Event Date is not valid';
    // Past dates are allowed (they show under Past Events once expired).
    if (!helpers.isValidTime(startTime) || !helpers.isValidTime(endTime)) throw 'Start and/or end time is not valid';
    if (!helpers.compareTimes(startTime, endTime)) throw 'Start time has to be 30min before end time';

    if (maxCapacity == null || typeof maxCapacity !== 'number') throw 'Invalid max capacity!';
    if (maxCapacity <= 0) throw 'Max cap. should be > 0';
    if (maxCapacity % 1 != 0) throw 'Max cap. not a whole number';

    helpers.validateLocation(gameLocation);

    helpers.isValidId(organizer);
    if (!usersData.isUserAdmin(organizer)) throw 'User is not an admin';

    return { gameName, gameDescription, gameDate, startTime, endTime, maxCapacity, gameLocation, link, linkdesc };
};

const filterPrivateGames = (gameList, viewerId = null) => {
    return gameList.filter((g) => {
        const vis = g.visibility === 'private' ? 'private' : 'public';
        if (vis !== 'private') return true;
        if (!viewerId) return false;
        if (g.organizer === viewerId) return true;
        return Array.isArray(g.players) && g.players.includes(viewerId);
    });
};

const shouldListOnEventsPage = (game) => game.listOnEventsPage !== false;

const create = async (
    gameName,
    gameDescription,
    gameLocation,
    maxCapacity,
    gameDate,
    startTime,
    endTime,
    group,
    organizer,
    link,
    linkdesc,
    visibility = 'public',
    privateDescription = '',
    link2 = '',
    link2desc = '',
    group2 = '',
    group3 = '',
    shortDescription = ''
) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer, link, linkdesc);

    const groups = helpers.normalizeHostGroups(group, group2, group3);
    // Keep legacy single `group` field for older callers/templates
    const primaryGroup = groups[0] || 'N/A';

    helpers.isValidId(organizer);

    visibility = helpers.normalizeVisibility(visibility);
    privateDescription = helpers.optionalString(privateDescription, 'Private description');
    shortDescription = xss(helpers.optionalString(shortDescription, 'Short description', 1000));
    const website = helpers.normalizeOptionalLinkPair(link, linkdesc, 'Link', 'Link Description');
    const social = helpers.normalizeOptionalLinkPair(link2, link2desc, 'Link 2', 'Link 2 Description');

    // Past-dated events are created already expired so they appear under Past Events
    const expired = helpers.isDateInFuture(gameData.gameDate);

    // Add game to database
    let newgame = {
        gameName: gameData.gameName,
        description: gameData.gameDescription,
        gameLocation: gameData.gameLocation,
        maxCapacity: gameData.maxCapacity,
        gameDate: gameData.gameDate,
        startTime: gameData.startTime,
        endTime: gameData.endTime,
        players: [organizer],
        totalNumberOfPlayers: 1,
        group: primaryGroup,
        groups,
        organizer,
        comments: [],
        gameImage: 'https://storage.googleapis.com/family-frisbee-media/icons/Full_court.png',
        map: '',
        directions: '',
        expired,
        link: website.link || gameData.link || '',
        linkdesc: website.linkdesc || gameData.linkdesc || '',
        link2: social.link,
        link2desc: social.linkdesc,
        visibility,
        privateDescription,
        shortDescription,
        listOnEventsPage: true,
        slideshowImages: [],
        leaders: [],
    };

    const gameCollection = await games();

    const insertInfo = await gameCollection.insertOne(newgame);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) throw 'Could not add game';

    const newId = insertInfo.insertedId.toString();

    const game = await gameCollection.findOne({ _id: new ObjectId(newId) });
    game._id = game._id.toString();
    const userCollection = await users();
    const updateUser = await userCollection.updateOne({ _id: new ObjectId(organizer) }, { $push: { games: game._id } });
    if (!updateUser) {
        throw 'Could not update the organizer';
    }
    return game;
};

const get = async (gameId) => {
    // Input Validation
    helpers.isValidId(gameId);
    gameId = gameId.trim();

    // Get game with given id
    const gameCollection = await games();
    const game = await gameCollection.findOne({ _id: new ObjectId(gameId) });
    if (game === null) throw 'No game with that id';
    game._id = game._id.toString();
    if (!Array.isArray(game.slideshowImages)) game.slideshowImages = [];
    if (!Array.isArray(game.leaders)) game.leaders = [];
    if (!Array.isArray(game.groups)) {
        game.groups = game.group && game.group !== 'N/A' ? [game.group] : [];
    }
    if (game.link2 == null) game.link2 = '';
    if (game.link2desc == null) game.link2desc = '';
    if (game.shortDescription == null) game.shortDescription = '';
    if (game.listOnEventsPage == null) game.listOnEventsPage = true;
    return helpers.withVisibilityDefaults(game);
};

// Only gets all games in the future
// Set includeExpired to true to get all previous games
const getAll = async (includeExpired = false, viewerId = null) => {
    const query = includeExpired ? {} : { expired: false };

    const gameCollection = await games();
    let gameList = await gameCollection.find(query).toArray();

    if (!gameList) throw 'Could not get all games';

    gameList = filterPrivateGames(gameList, viewerId).filter(shouldListOnEventsPage);
    gameList = gameList.map((element) => {
        element._id = element._id.toString();
        if (element.visibility !== 'private') element.visibility = 'public';
        return element;
    });
    return gameList;
};

const getPast = async (viewerId = null) => {
    const gameCollection = await games();
    let gameList = await gameCollection.find({ expired: true }).toArray();
    if (!gameList) throw 'Could not get past games';
    gameList = filterPrivateGames(gameList, viewerId).filter(shouldListOnEventsPage);
    gameList = gameList.map((element) => {
        element._id = element._id.toString();
        if (element.visibility !== 'private') element.visibility = 'public';
        return element;
    });
    return gameList;
};

// Get all games of given group
// Set includeExpired to false to get only future games
const getAllByGroup = async (groupId, includeExpired = true, viewerId = null) => {
    const gameList = await getAll(includeExpired, viewerId);
    let groupGames = [];

    for (const game of gameList) {
        const ids = Array.isArray(game.groups) && game.groups.length
            ? game.groups
            : game.group && game.group !== 'N/A'
              ? [game.group]
              : [];
        if (ids.includes(groupId) || game.group === groupId) groupGames.push(game);
    }

    return groupGames;
};

const addComment = async (gameId, userId, comment) => {
    // Input Validation
    helpers.isValidId(gameId);
    helpers.isValidId(userId);
    gameId = gameId.trim();
    userId = userId.trim();

    if (!comment) throw 'Comment is not provided';
    if (typeof comment !== 'string') throw 'Comment is not a string';
    comment = comment.trim();
    if (comment.length === 0) throw 'Comment is all whitespace';

    const game = await get(gameId);
    if (!game.players.includes(userId)) throw 'Commenter is not in the group';

    // Update record
    const newComment = {
        _id: new ObjectId(),
        userId,
        timestamp: new Date(),
        commentText: xss(comment),
    };

    const gameCollection = await games();
    const updatedInfo = await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $push: { comments: newComment } });

    if (!updatedInfo) throw 'Could not update group successfully';

    return updatedInfo;
};

const removeComment = async (gameId, commentId) => {
    helpers.isValidId(gameId);
    helpers.isValidId(commentId);
    gameId = gameId.trim();
    commentId = commentId.trim();

    const gameCollection = await games();
    const removedComment = await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $pull: { comments: { _id: new ObjectId(commentId) } } });
    if (!removedComment) {
        throw 'Could not delete comment successfully';
    }

    return removedComment;
};

const addUser = async (userId, gameId) => {
    //Input validation
    helpers.isValidId(userId); //maybe should check if is userid and not gameid etc
    helpers.isValidId(gameId);
    userId = userId.trim();
    gameId = gameId.trim();

    const game = await get(gameId);
    if (!game) {
        throw 'Could not find game';
    }
    if (game.maxCapacity <= game.players.length) {
        throw 'Game is full';
    }
    if (game.players.includes(userId)) {
        throw 'User is already in the game.';
    }
    const user = await usersData.getUser(userId);
    if (!user) {
        throw 'Could not find user';
    }
    //Update game collection
    const gameCollection = await games();
    const userCollection = await users();
    const updateGame = await gameCollection.updateOne(
        { _id: new ObjectId(gameId) },
        {
            $push: { players: userId },
            $inc: { totalNumberOfPlayers: 1 },
        }
    );
    const updateUser = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $push: { games: gameId } });
    if (!updateUser || !updateGame) {
        throw 'Could not update user or game';
    }
    return { updateUser, updateGame };
};

const searchGames = async (search, viewerId = null) => {
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
    const gameCollection = await games();
    const reg = new RegExp(`${search}`, 'i'); // 'i' for case-insensitive
    let gameList = await gameCollection.find({ gameName: reg }).limit(resultSize).toArray();
    if (!gameList || gameList.length === 0) {
        throw "Couldn't find any games with that name";
    }
    gameList = filterPrivateGames(gameList, viewerId);
    gameList = gameList.map((element) => {
        element._id = element._id.toString();
        if (element.visibility !== 'private') element.visibility = 'public';
        return element;
    });
    return gameList;
};

const remove = async (gameId) => {
    // Input Validation
    helpers.isValidId(gameId);
    gameId = gameId.trim();

    // Delete game with given id
    const gameCollection = await games();
    const deletionInfo = await gameCollection.findOneAndDelete(
        {
            _id: new ObjectId(gameId),
        },
        { returnDocument: 'after' }
    );
    const userCollection = await users();
    const userUpdateResult = await userCollection.updateMany({ games: gameId }, { $pull: { games: gameId } });

    if (!userUpdateResult) {
        throw 'Could not remove gameid from users';
    }
    if (!deletionInfo) {
        throw `Could not delete game with id of ${gameId}`;
    }

    // Delete info from bucket
    await picturesData.deleteUserFolder(gameId);

    const res = { gameName: deletionInfo.gameName, deleted: true };
    return res;
};

const normalizeLeaders = (leadersInput) => {
    if (!leadersInput) return [];
    let rows = leadersInput;
    if (!Array.isArray(rows) && typeof rows === 'object') {
        rows = Object.keys(rows)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => rows[k]);
    }
    if (!Array.isArray(rows)) return [];

    const leaders = [];
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const title = helpers.optionalString(row.title, 'Leader title', 80);
        const userId = row.userId != null ? String(row.userId).trim() : '';
        if (!title && !userId) continue;
        if (!title) throw 'Each leader needs a title';
        helpers.isValidId(userId);
        leaders.push({ title, userId });
    }
    return leaders;
};

const update = async (
    gameId,
    userId,
    gameName,
    gameDescription,
    gameLocation,
    maxCapacity,
    gameDate,
    startTime,
    endTime,
    group,
    gameImage,
    map,
    directions,
    link,
    linkdesc,
    visibility,
    privateDescription,
    leaders,
    link2,
    link2desc,
    group2,
    group3,
    listOnEventsPage,
    shortDescription
) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, userId, link, linkdesc);

    const oldGame = await get(gameId); // Check if game exists
    const nextLeaders = leaders !== undefined ? normalizeLeaders(leaders) : oldGame.leaders || [];
    const groups =
        group !== undefined || group2 !== undefined || group3 !== undefined
            ? helpers.normalizeHostGroups(group, group2, group3)
            : oldGame.groups || (oldGame.group && oldGame.group !== 'N/A' ? [oldGame.group] : []);
    const primaryGroup = groups[0] || 'N/A';

    const website =
        link !== undefined
            ? helpers.normalizeOptionalLinkPair(link, linkdesc, 'Link', 'Link Description')
            : { link: oldGame.link || '', linkdesc: oldGame.linkdesc || '' };
    const social =
        link2 !== undefined
            ? helpers.normalizeOptionalLinkPair(link2, link2desc, 'Link 2', 'Link 2 Description')
            : { link: oldGame.link2 || '', linkdesc: oldGame.link2desc || '' };

    // Recompute expired from the (possibly new) date
    const expired = helpers.isDateInFuture(gameData.gameDate);

    // Update record
    const updatedgame = {
        gameName: gameData.gameName,
        organizer: userId,
        description: gameData.gameDescription,
        gameLocation: gameData.gameLocation,
        maxCapacity: gameData.maxCapacity,
        gameDate: gameData.gameDate,
        startTime: gameData.startTime,
        endTime: gameData.endTime,
        players: oldGame.players,
        totalNumberOfPlayers: oldGame.totalNumberOfPlayers,
        comments: oldGame.comments,
        group: primaryGroup,
        groups,
        gameImage: gameImage ? gameImage : oldGame.gameImage,
        expired,
        map: map ?? oldGame.map,
        directions: directions ?? oldGame.directions,
        link: website.link,
        linkdesc: website.linkdesc,
        link2: social.link,
        link2desc: social.linkdesc,
        visibility: visibility != null ? helpers.normalizeVisibility(visibility) : oldGame.visibility || 'public',
        listOnEventsPage: listOnEventsPage != null ? !!listOnEventsPage : oldGame.listOnEventsPage !== false,
        shortDescription:
            shortDescription != null
                ? xss(helpers.optionalString(shortDescription, 'Short description', 1000))
                : oldGame.shortDescription || '',
        privateDescription:
            privateDescription != null
                ? helpers.optionalString(privateDescription, 'Private description')
                : oldGame.privateDescription || '',
        slideshowImages: oldGame.slideshowImages || [],
        leaders: nextLeaders,
    };

    const gameCollection = await games();
    const updatedInfo = await gameCollection.findOneAndReplace({ _id: new ObjectId(gameId) }, updatedgame, { returnDocument: 'after' });
    if (!updatedInfo) {
        throw 'could not update game successfully';
    }
    return await get(gameId);
};

const getIDName = async (gameIds) => {
    //Given an array of IDs return an array of objects, each object contains the id and the associated name
    let ret = [];
    for (let gameId of gameIds) {
        helpers.isValidId(gameId);
        gameId = gameId.trim();

        try {
            const game = await get(gameId);
            ret.push({ _id: gameId, name: game.gameName, gameDate: game.gameDate });
        } catch (e) {
            // In the case that a game doesn't exist, we skip
            continue;
        }
    }
    return ret;
};

// Goes through all (future) games to make sure they haven't passed and updates them if they are old
// Bypasses getAll visibility filtering so private events still expire
const keepStatusUpdated = async () => {
    const gameCollection = await games();
    const gamesList = await gameCollection.find({ expired: false }).toArray();

    //console.log('Checking for expired games');

    for (let game of gamesList) {
        if (helpers.isDateInFuture(game.gameDate)) {
            try {
                await gameCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: { expired: true } });
            } catch (err) {
                throw 'Unable to update status of old game';
            }
            console.log(`Expired game: ${game._id}`);
        }
    }
};

const leaveGame = async (userId, gameId) => {
    helpers.isValidId(userId);
    helpers.isValidId(gameId);
    const game = await get(gameId);
    const user = await usersData.getUser(userId);
    if (!game) throw 'Could not find game';
    if (!user) throw 'Could not find user';
    if (!game.players.includes(userId)) throw 'User is not a part of this group';
    if (!user.games.includes(gameId)) throw 'User is not a part of this group';

    const gameCollection = await games();
    const userCollection = await users();

    const updateUser = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $pull: { games: gameId } });

    const updateGame = await gameCollection.updateOne(
        { _id: new ObjectId(gameId) },
        {
            $pull: { players: userId },
            $inc: { totalNumberOfPlayers: -1 },
        }
    );
    if (updateUser.modifiedCount === 0 || updateGame.modifiedCount === 0) {
        throw 'Could not update user or game';
    }
    return { updateUser, updateGame };
};

const editGameImage = async (gameId, imagePath) => {
    const game = await get(gameId);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';

    const url = `${base}/${bucketName}/${gameId}/${imagePath}`;
    await update(
        gameId,
        game.organizer,
        game.gameName,
        game.description,
        game.gameLocation,
        game.maxCapacity,
        game.gameDate,
        game.startTime,
        game.endTime,
        game.group,
        url,
        game.map,
        game.directions,
        game.link,
        game.linkdesc,
        game.visibility,
        game.privateDescription,
        game.leaders,
        game.link2,
        game.link2desc,
        (game.groups && game.groups[1]) || '',
        (game.groups && game.groups[2]) || ''
    );
};

const addSlideshowImage = async (gameId, imagePath) => {
    helpers.isValidId(gameId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${gameId}/${imagePath}`;
    const slide = { url, caption: helpers.captionFromImageUrl(url) };

    const gameCollection = await games();
    const updatedInfo = await gameCollection.updateOne(
        { _id: new ObjectId(gameId) },
        { $push: { slideshowImages: slide } }
    );
    if (!updatedInfo) throw 'Could not update game successfully';
    return updatedInfo;
};

const removeSlideshowImage = async (gameId, imagePath) => {
    helpers.isValidId(gameId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${gameId}/${imagePath}`;

    const game = await get(gameId);
    const next = helpers
        .normalizeSlideshowSlides(game.slideshowImages || [])
        .filter((slide) => slide.url !== url);

    const gameCollection = await games();
    const updatedInfo = await gameCollection.updateOne(
        { _id: new ObjectId(gameId) },
        { $set: { slideshowImages: next } }
    );
    if (!updatedInfo) throw 'Could not update game successfully';
    return updatedInfo;
};

const updateSlideshowCaption = async (gameId, imageUrl, caption) => {
    helpers.isValidId(gameId);
    helpers.stringHelper(imageUrl, 'Image URL', 1, 2048);
    const nextCaption = helpers.optionalString(caption, 'Caption', 200);

    const game = await get(gameId);
    const slides = helpers.normalizeSlideshowSlides(game.slideshowImages || []);
    let found = false;
    const next = slides.map((slide) => {
        if (helpers.slideshowUrlsMatch(slide.url, imageUrl)) {
            found = true;
            return { url: slide.url, caption: nextCaption };
        }
        return slide;
    });
    if (!found) throw 'Slideshow image not found';

    const gameCollection = await games();
    const updatedInfo = await gameCollection.updateOne(
        { _id: new ObjectId(gameId) },
        { $set: { slideshowImages: next } }
    );
    if (!updatedInfo) throw 'Could not update caption';
    return updatedInfo;
};

export default {
    create,
    getAll,
    getPast,
    get,
    getAllByGroup,
    addComment,
    removeComment,
    remove,
    update,
    addUser,
    searchGames,
    keepStatusUpdated,
    getIDName,
    leaveGame,
    formatAndValidateGame,
    editGameImage,
    addSlideshowImage,
    removeSlideshowImage,
    updateSlideshowCaption,
    normalizeLeaders,
};
