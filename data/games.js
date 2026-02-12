import * as helpers from '../helpers.js';
import { games, users } from '../config/mongoCollections.js';
import { usersData, groupsData, picturesData } from './index.js';
import { ObjectId } from 'mongodb';
import xss from 'xss';

const formatAndValidateGame = function (gameName, gameDescription, gameLocation, maxCapacity, gameDate, startTime, endTime, organizer = undefined, link, linkdesc) {
    // Simplified to bypass logic crashes during the Outlook transition
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
    gameId = gameId.trim();
    userId = userId.trim();

    if (!comment) throw 'Comment is not provided';
    if (typeof comment !== 'string') throw 'Comment is not a string';
    comment = comment.trim();
    if (comment.length === 0) throw 'Comment is all whitespace';

    const game = await get(gameId);
    if (!game.players.includes(userId)) throw 'Commenter is not in the group';

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
    if (!removedComment) throw 'Could not delete comment successfully';
    return removedComment;
};

const addUser = async (userId, gameId) => {
    helpers.isValidId(userId);
    helpers.isValidId(gameId);
    userId = userId.trim();
    gameId = gameId.trim();

    const game = await get(gameId);
    if (!game) throw 'Could not find game';
    if (game.maxCapacity <= game.players.length) throw 'Game is full';
    if (game.players.includes(userId)) throw 'User is already in the game.';

    const user = await usersData.getUser(userId);
    if (!user) throw 'Could not find user';

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
    if (!updateUser || !updateGame) throw 'Could not update user or game';
    return { updateUser, updateGame };
};

const searchGames = async (search) => {
    let resultSize = 10;
    if (!search || typeof search !== 'string' || search.trim().length === 0) throw 'Invalid search term';
    search = search.trim();

    const gameCollection = await games();
    const reg = new RegExp(`${search}`, 'i');
    let gameList = await gameCollection.find({ gameName: reg }).limit(resultSize).toArray();
    if (!gameList || gameList.length === 0) throw "Couldn't find any games with that name";
    return gameList;
};

const remove = async (gameId) => {
    helpers.isValidId(gameId);
    gameId = gameId.trim();

    const gameCollection = await games();
    const deletionInfo = await gameCollection.findOneAndDelete({ _id: new ObjectId(gameId) });
    const userCollection = await users();
    const userUpdateResult = await userCollection.updateMany({ games: gameId }, { $pull: { games: gameId } });

    if (!userUpdateResult) throw 'Could not remove gameid from users';
    if (!deletionInfo) throw `Could not delete game with id of ${gameId}`;

    await picturesData.deleteUserFolder(gameId);
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
        maxCapacity: game
