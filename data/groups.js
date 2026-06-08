import * as helpers from '../helpers.js';
import { groups, users, games } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import { usersData, gamesData, picturesData } from './index.js';
import xss from 'xss';

const create = async (groupName, groupDescription, groupLeader, coLeaders, uppercaseTitle, lowercaseTitle, numericTitle) => {
    // Input Validation
    helpers.validateGroup(groupName, groupDescription, groupLeader);

    groupName = groupName.trim();
    groupDescription = groupDescription.trim();
    
    // Default fallback values if fields were left blank in the form
    uppercaseTitle = uppercaseTitle && uppercaseTitle.trim() ? xss(uppercaseTitle.trim()) : "All Caps Members";
    lowercaseTitle = lowercaseTitle && lowercaseTitle.trim() ? xss(lowercaseTitle.trim()) : "Lowercase Members";
    numericTitle = numericTitle && numericTitle.trim() ? xss(numericTitle.trim()) : "Numbered Members";

    // Add group to database
    const newgroup = {
        groupName: xss(groupName),
        description: xss(groupDescription),
        groupLeader,
        coLeaders, // <--- Add this line here
        uppercaseTitle,
        lowercaseTitle,
        numericTitle,
        comments: [],
        // ... rest of the object
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

const getAll = async () => {
    const groupCollection = await groups();
    let groupList = await groupCollection.find({}).project({ _id: 1, groupName: 1 }).toArray();

    if (!groupList) throw 'Could not get all groups';
    groupList = groupList.map((element) => {
        element._id = element._id.toString();
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

    return group;
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

const update = async (groupId, groupName, groupDescription, groupLeader, groupImage) => {
    // Input Validation
    helpers.isValidId(groupId);
    groupId = groupId.trim();

    helpers.validateGroup(groupName, groupDescription, groupLeader);

    groupName = groupName.trim();
    groupDescription = groupDescription.trim();

    const oldGroup = await get(groupId); // Check if group exists

    // Update record
    const updatedgroup = {
        groupName: xss(groupName),
        description: xss(groupDescription),
        groupLeader,
        comments: oldGroup.comments,
        players: oldGroup.players,
        totalNumberOfPlayers: oldGroup.totalNumberOfPlayers,
        groupImage: groupImage ? groupImage : oldGroup.groupImage,
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

const searchGroups = async (search) => {
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

    //Returns the entire grouplist right now
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
    await update(groupId, group.groupName, group.description, group.groupLeader, url);
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
};
