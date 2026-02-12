import * as helpers from '../helpers.js';
import { games, users } from '../config/mongoCollections.js';
import { usersData, groupsData, picturesData } from './index.js';
import { ObjectId } from 'mongodb';
import xss from 'xss';

const formatAndValidateGame = function (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer = undefined, link, linkdesc) {
    gameName = helpers.stringHelper(gameName, 'Game name', 5, null);
    gameDescription = helpers.stringHelper(gameDescription, 'Game description', 1, null);
    gameDate = helpers.stringHelper(gameDate, 'Game date', 1, null);
    startTime = helpers.stringHelper(startTime, 'Start time', 1, null);
    endTime = helpers.stringHelper(endTime, 'End time', 1, null);

    //if (link != ""){ linkdesc = helpers.stringHelper(linkdesc, 'Link Description', 1, 300); }

    if (!helpers.isValidDay(gameDate)) throw 'Event Date is not valid';
    
    if (!helpers.isValidTime(startTime) || !helpers.isValidTime(endTime)) throw 'Start and/or end time is not valid';
    if (!helpers.compareTimes(startTime, endTime)) throw 'Start time has to be 30min before end time';

    if (maxCapacity == null || typeof maxCapacity !== 'number') throw 'Invalid max capacity!';
    if (maxCapacity <= 0) throw 'Max cap. should be > 0';
    if (maxCapacity % 1 != 0) throw 'Max cap. not a whole number';

    helpers.validateLocation(gameLocation);

    helpers.isValidId(organizer);

    return { gameName, gameDescription, gameDate, startTime, endTime, maxCapacity, gameLocation, link, linkdesc };
};

const create = async (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, group, organizer, link, linkdesc) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer, link, linkdesc );

    // Group is optional
    if (group !== 'N/A') helpers.isValidId(group);

    helpers.isValidId(organizer);

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
        group,
        organizer,
        comments: [],
        gameImage: 'https://storage.googleapis.com/family-frisbee-media/icons/Full_court.png',
        map: '',
        directions: '',
        expired: false,
        link: gameData.link,
        linkdesc: gameData.linkdesc,
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
    //await closeConnection(); // For testing purposes
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
    return game;
};

// Only gets all games in the future
// Set includeExpired to true to get all previous games
const getAll = async (includeExpired = false) => {
    const query = includeExpired ? {} : { expired: false };

    const gameCollection = await games();
    let gameList = await gameCollection.find(query).toArray();

    if (!gameList) throw 'Could not get all games';

    gameList = gameList.map((element) => {
        element._id = element._id.toString();
        return element;
    });
    return gameList;
};

// Get all games of given group
// Set includeExpired to false to get only future games
const getAllByGroup = async (groupId, includeExpired = true) => {
    const gameList = await getAll(includeExpired);
    let groupGames = [];

    for (const game of gameList) {
        if (game.group === groupId) groupGames.push(game);
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

const searchGames = async (search) => {
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
    //Returns the entire gamelist right now
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
    linkdesc
) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, userId, link, linkdesc);

    const oldGame = await get(gameId); // Check if game exists

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
        group,
        gameImage: gameImage ? gameImage : oldGame.gameImage,
        expired: oldGame.expired,
        map: map ?? oldGame.map,
        directions: directions ?? oldGame.directions,
        link: gameData.link,
        linkdesc: gameData.linkdesc
    };

    const gameCollection = await games();
    const updatedInfo = await gameCollection.findOneAndReplace({ _id: new ObjectId(gameId) }, updatedgame, { returnDocument: 'after' });
    if (!updatedInfo) {
        throw 'could not update game successfully';
    }
    updatedInfo._id = updatedInfo._id.toString();
    return updatedInfo;
};

const getIDName = async (gameIds) => {
    //Given an array of IDs return an array of objects, each object contains the id and the associated name
    let ret = [];
    for (let gameId of gameIds) {
        helpers.isValidId(gameId);
        gameId = gameId.trim();

        try {
            const game = await get(gameId);
            ret.push({ _id: gameId, name: game.gameName });
        } catch (e) {
            // In the case that a game doesn't exist, we skip
            continue;
        }
    }
    return ret;
};

// Goes through all (future) games to make sure they haven't passed and updates them if they are old
const keepStatusUpdated = async () => {
    const gamesList = await getAll();
    const gameCollection = await games();

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
        game.link,
        game.linkdesc
    );
};

export default {
    create,
    getAll,
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
};
