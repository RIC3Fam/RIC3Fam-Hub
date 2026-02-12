import * as helpers from '../helpers.js';
import { games, users } from '../config/mongoCollections.js';
import { usersData, groupsData, picturesData } from './index.js';
import { ObjectId } from 'mongodb';
import xss from 'xss';

const formatAndValidateGame = function (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer = undefined, link, linkdesc) {
    return { gameName, gameDescription, gameDate, startTime, endTime, maxCapacity, gameLocation, link, linkdesc };
};

const create = async (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, group, organizer, link, linkdesc) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer, link, linkdesc );
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
    await userCollection.updateOne({ _id: new ObjectId(organizer) }, { $push: { games: game._id } });
    return game;
};

const get = async (gameId) => {
    helpers.isValidId(gameId);
    gameId = gameId.trim();
    const gameCollection = await games();
    const game = await gameCollection.findOne({ _id: new ObjectId(gameId) });
    if (game === null) throw 'No game with that id';
    game._id = game._id.toString();
    return game;
};

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

const getAllByGroup = async (groupId, includeExpired = true) => {
    const gameList = await getAll(includeExpired);
    let groupGames = [];
    for (const game of gameList) {
        if (game.group === groupId) groupGames.push(game);
    }
    return groupGames;
};

const addComment = async (gameId, userId, comment) => {
    helpers.isValidId(gameId);
    helpers.isValidId(userId);
    const game = await get(gameId);
    if (!game.players.includes(userId)) throw 'Commenter is not in the group';
    const newComment = { _id: new ObjectId(), userId, timestamp: new Date(), commentText: xss(comment) };
    const gameCollection = await games();
    const updatedInfo = await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $push: { comments: newComment } });
    return updatedInfo;
};

const removeComment = async (gameId, commentId) => {
    const gameCollection = await games();
    return await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $pull: { comments: { _id: new ObjectId(commentId) } } });
};

const addUser = async (userId, gameId) => {
    const game = await get(gameId);
    if (game.maxCapacity <= game.players.length) throw 'Game is full';
    const gameCollection = await games();
    const userCollection = await users();
    const updateGame = await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $push: { players: userId }, $inc: { totalNumberOfPlayers: 1 } });
    const updateUser = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $push: { games: gameId } });
    return { updateUser, updateGame };
};

const searchGames = async (search) => {
    const gameCollection = await games();
    const reg = new RegExp(`${search.trim()}`, 'i');
    return await gameCollection.find({ gameName: reg }).limit(10).toArray();
};

const remove = async (gameId) => {
    const gameCollection = await games();
    const deletionInfo = await gameCollection.findOneAndDelete({ _id: new ObjectId(gameId) });
    const userCollection = await users();
    await userCollection.updateMany({ games: gameId }, { $pull: { games: gameId } });
    return { gameName: deletionInfo.gameName, deleted: true };
};

const update = async (gameId, userId, gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, group, gameImage, map, directions, link, linkdesc) => {
    let gameData = formatAndValidateGame(gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, userId, link, linkdesc);
    const oldGame = await get(gameId);
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
    updatedInfo._id = updatedInfo._id.toString();
    return updatedInfo;
};

const getIDName = async (gameIds) => {
    let ret = [];
    for (let gameId of gameIds) {
        try {
            const game = await get(gameId);
            ret.push({ _id: gameId, name: game.gameName });
        } catch (e) { continue; }
    }
    return ret;
};

const keepStatusUpdated = async () => {
    const gamesList = await getAll();
    const gameCollection = await games();
    for (let game of gamesList) {
        if (helpers.isDateInFuture(game.gameDate)) {
            await gameCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: { expired: true } });
        }
    }
};

const leaveGame = async (userId, gameId) => {
    const gameCollection = await games();
    const userCollection = await users();
    await userCollection.updateOne({ _id: new ObjectId(userId) }, { $pull: { games: gameId } });
    await gameCollection.updateOne({ _id: new ObjectId(gameId) }, { $pull: { players: userId }, $inc: { totalNumberOfPlayers: -1 } });
    return true;
};

const editGameImage = async (gameId, imagePath) => {
    const game = await get(gameId);
    const url = `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${gameId}/${imagePath}`;
    await update(gameId, game.organizer, game.gameName, game.description, game.gameLocation, game.maxCapacity, game.gameDate, game.startTime, game.endTime, game.group, url, game.link, game.linkdesc);
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
    editGameImage
};
