import * as helpers from '../helpers.js';
import { users, games, groups } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { picturesData } from './index.js';

const searchUsers = async (search, viewer = null) => {
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
    const userCollection = await users();
    const reg = new RegExp(`${search}`, 'i'); // 'i' for case-insensitive
    let userList = await userCollection
        .find({ $or: [{ username: reg }, { name: reg }] })
        .limit(resultSize)
        .toArray();
    if (!userList || userList.length === 0) {
        throw "Couldn't find any users with that name";
    }
    // Exclude private users unless viewer may access (owner, family, or admin)
    // Support legacy callers that passed viewerId string
    const viewerObj = typeof viewer === 'string' ? { _id: viewer } : viewer;
    userList = userList.filter((u) => {
        const normalized = helpers.withVisibilityDefaults({
            ...u,
            _id: u._id.toString(),
        });
        return helpers.viewerCanAccessUser(viewerObj, normalized);
    });
    //Returns everything besides password, feel free to change
    userList = userList.map(
        (user) =>
            (user = {
                _id: user._id.toString(),
                username: user.username,
                name: user.name,
                emailAddress: user.emailAddress,
                description: user.description,
                profilePicture: user.profilePicture,
                friends: user.friends,
                games: user.games,
                groups: user.groups,
                visibility: user.visibility === 'private' ? 'private' : 'public',
            })
    );
    return userList;
};

export function formatAndValidateUser(userData, ignorePassword) {
    // Formats the data fields and checks if they are valid for user data fields. Doesn't check things like duplicate email, etc.
    let username = helpers.stringHelper(userData.username, 'Username', 3, 20);
    let name = helpers.stringHelper(userData.name, 'Name', 1, 50);
    let emailAddress = userData.emailAddress;
    let password;

    let link1desc = "";
    let link1 = "";
    let link2desc = "";
    let link2 = "";
    let link3desc = "";
    let link3 = "";
    let link4desc = "";
    let link4 = "";
    if (userData.link1 != null && userData.link1 != ""){ 
        link1 = helpers.stringHelper(userData.link1, "Link 1");
        link1desc = helpers.stringHelper(userData.link1desc, 'Link 1 Description', 1, 100); 
    }
    if(userData.link2 != null && userData.link2 != ""){ 
        link2 = helpers.stringHelper(userData.link2, 'Link 2')
        link2desc = helpers.stringHelper(userData.link2desc, 'Link 2 Description', 1, 100); 
    }
    if(userData.link3 != null && userData.link3 != ""){ 
        link3 = helpers.stringHelper(userData.link3, 'Link 3')
        link3desc = helpers.stringHelper(userData.link3desc, 'Link 3 Description', 1, 100); 
    }
    if(userData.link4 != null && userData.link4 != ""){ 
        link4 = helpers.stringHelper(userData.link4, 'Link 4')
        link4desc = helpers.stringHelper(userData.link4desc, 'Link 4 Description', 1, 100); 
    }


    if (emailAddress) helpers.isValidEmail(emailAddress);

    if (!ignorePassword) {
        //err...
        password = helpers.stringHelper(userData.password, 'Password', 1, null);
        helpers.validatePassword(password);
    } else {
        password = userData.password;
    }

    // Checks to make sure skills are valid and converts them to boolean
    if (userData.skills) {
        for (const [key, value] of Object.entries(userData.skills)) {
            //console.log(key, value);
            if (typeof value !== 'string' && typeof value !== 'object') throw `Skill '${key}, ${value}' is not valid`;
            if (value.type === 'checkbox') {
                if (value.value !== undefined && !['true', 'false'].includes(value.value.toString())) throw `Skill '${key}, ${value}' is not valid`;
                if (value.value === 'true') userData.skills[key].value = true;
                else userData.skills[key].value = false;
            }
        }
    }

    let profilePicture = helpers.stringHelper(userData.profilePicture, 'Profile picture', null, 2048);
    let description =
        userData.description == null || userData.description === ''
            ? ''
            : helpers.stringHelper(userData.description, 'Description', null, null);
    let statement = helpers.optionalString(userData.statement, 'Short description');
    let additionalDescription = helpers.optionalString(userData.additionalDescription, 'Additional description');
    let slideshowDescription = helpers.optionalString(userData.slideshowDescription, 'Slideshow description');
    let statement2 = helpers.optionalString(userData.statement2, 'Short description 2');
    let visibility = helpers.normalizeVisibility(userData.visibility);
    let privateDescription = helpers.optionalString(userData.privateDescription, 'Private communications');
    let preferredEmail = helpers.optionalString(userData.preferredEmail, 'Preferred email', 120);
    if (preferredEmail) helpers.isValidEmail(preferredEmail);
    let preferredPhone = helpers.optionalString(userData.preferredPhone, 'Preferred phone', 40);
    let birthday = helpers.optionalString(userData.birthday, 'Birthday', 30);
    let halfBirthday = helpers.optionalString(userData.halfBirthday, 'Half birthday', 30);
    const optInCreativeRealEstate = !!(
        userData.optInCreativeRealEstate === true ||
        userData.optInCreativeRealEstate === 'true' ||
        userData.optInCreativeRealEstate === 'on'
    );
    const optInFrisbeeNotices = !!(
        userData.optInFrisbeeNotices === true ||
        userData.optInFrisbeeNotices === 'true' ||
        userData.optInFrisbeeNotices === 'on'
    );
    const optInCcsnUpdates = !!(
        userData.optInCcsnUpdates === true ||
        userData.optInCcsnUpdates === 'true' ||
        userData.optInCcsnUpdates === 'on'
    );
    const onlyRecentEvents = !!(
        userData.onlyRecentEvents === true ||
        userData.onlyRecentEvents === 'true' ||
        userData.onlyRecentEvents === 'on'
    );
    let adminNotes = helpers.optionalString(userData.adminNotes, 'Admin notes');
    return {
        username,
        emailAddress,
        password,
        profilePicture,
        description,
        skills: userData.skills,
        name,
        link1,
        link1desc,
        link2,
        link2desc,
        link3,
        link3desc,
        link4,
        link4desc,
        statement,
        additionalDescription,
        slideshowDescription,
        statement2,
        visibility,
        privateDescription,
        preferredEmail,
        preferredPhone,
        birthday,
        halfBirthday,
        optInCreativeRealEstate,
        optInFrisbeeNotices,
        optInCcsnUpdates,
        onlyRecentEvents,
        adminNotes,
    };
}

const createUser = async (username, emailAddress, password, pfp, description, name) => {
    if (!pfp) {
        pfp = 'https://storage.googleapis.com/family-frisbee-media/icons/RIC3FAM.jpg';
    }
    if (!description) {
        description = '';
    }
    let userData = { username, emailAddress, password, profilePicture: pfp, description, name };
    userData = formatAndValidateUser(userData, false);

    // Search for users with same username or email
    const userCollection = await users();
    const similarUser = await userCollection.findOne({
        username: { $regex: new RegExp(`^${username}$`, 'i') },
    });

    if (similarUser) {
        throw 'Username already taken';
    }

    const saltRounds = 16;
    const hashPass = await bcrypt.hash(userData.password, saltRounds);

    const skills = {
        under5: { desc: '5 and under', type: 'checkbox', value: false },
        above18: { desc: 'Above 18', type: 'checkbox', value: false },
        inSchool: { desc: 'Grade 1-12', type: 'number', value: 0 },
        playing: { desc: "I'll just watch and participate in community activities", type: 'checkbox', value: false },
        thrown: { desc: "I've thrown a frisbee before", type: 'checkbox', value: false },
        played: { desc: "I've played ultimate before here", type: 'text', value: '' },
    };

    // Create user
    const newUser = {
        _id: new ObjectId(),
        username: userData.username,
        name: userData.name,
        emailAddress: userData.emailAddress,
        description: userData.description,
        profilePicture: userData.profilePicture,
        password: hashPass,
        friends: [],
        games: [],
        groups: [],
        friendRequests: [],
        skills: skills,
        slideshowImages: [],
        statement: '',
        additionalDescription: '',
        slideshowDescription: '',
        statement2: '',
        link3: '',
        link3desc: '',
        link4: '',
        link4desc: '',
        onlyRecentEvents: false,
        visibility: 'public',
        privateDescription: '',
        preferredEmail: '',
        preferredPhone: '',
        birthday: '',
        halfBirthday: '',
        optInCreativeRealEstate: false,
        optInFrisbeeNotices: false,
        optInCcsnUpdates: false,
        adminNotes: '',
    };

    // Update the user
    const insertInfo = await userCollection.insertOne(newUser);
    if (!insertInfo.acknowledged || !insertInfo.insertedId) {
        throw 'Could not add user';
    }

    return { insertedUser: true };
};

const getIDName = async (userIds) => {
    //Given an array of IDs return an array of objects, each object contains the id and the associated name
    let ret = [];
    for (let userId of userIds) {
        helpers.isValidId(userId);
        userId = userId.trim();
        try {
            const user = await getUser(userId);
            ret.push({ _id: userId, name: user.username });
        } catch (e) {
            // In the case that a user doesnt exist, we just skip them
            continue;
        }
    }
    return ret;
};

const editUser = async (
    userId,
    username,
    emailAddress,
    profilePicture,
    description,
    skills,
    name,
    link1,
    link1desc,
    link2,
    link2desc,
    statement,
    additionalDescription,
    slideshowDescription,
    visibility,
    privateDescription,
    preferredEmail = '',
    preferredPhone = '',
    birthday = '',
    halfBirthday = '',
    optInCreativeRealEstate = false,
    optInFrisbeeNotices = false,
    optInCcsnUpdates = false,
    adminNotes = null,
    statement2 = '',
    link3 = '',
    link3desc = '',
    link4 = '',
    link4desc = '',
    onlyRecentEvents = false
) => {
    if (!userId) throw 'User Id not given';
    if (typeof userId !== 'string') throw 'User Id is not a string';
    userId = userId.trim();
    if (!ObjectId.isValid(userId)) throw 'User Id is not valid';
    if (typeof skills !== 'object') throw 'Skills is not an object';

    const existing = await getUser(userId);

    let userData = {
        username,
        emailAddress,
        password: '',
        profilePicture,
        description,
        skills,
        name,
        link1,
        link1desc,
        link2,
        link2desc,
        link3,
        link3desc,
        link4,
        link4desc,
        statement,
        additionalDescription,
        slideshowDescription,
        statement2,
        visibility,
        privateDescription,
        preferredEmail,
        preferredPhone,
        birthday,
        halfBirthday,
        optInCreativeRealEstate,
        optInFrisbeeNotices,
        optInCcsnUpdates,
        onlyRecentEvents,
        adminNotes: adminNotes != null ? adminNotes : existing.adminNotes || '',
    };
    userData = formatAndValidateUser(userData, true);

    const userCollection = await users();

    const similarUser = await userCollection.findOne({
        username: { $regex: new RegExp(`^${username}$`, 'i') },
    });

    if (similarUser._id != userId) {
        throw 'Username or Email address already taken';
    }

    await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
            $set: {
                username: userData.username,
                name: userData.name,
                emailAddress: userData.emailAddress,
                description: userData.description,
                profilePicture: userData.profilePicture,
                skills: userData.skills,
                link1: userData.link1,
                link1desc: userData.link1desc,
                link2: userData.link2,
                link2desc: userData.link2desc,
                link3: userData.link3,
                link3desc: userData.link3desc,
                link4: userData.link4,
                link4desc: userData.link4desc,
                statement: userData.statement,
                additionalDescription: userData.additionalDescription,
                slideshowDescription: userData.slideshowDescription,
                statement2: userData.statement2,
                visibility: userData.visibility,
                privateDescription: userData.privateDescription,
                preferredEmail: userData.preferredEmail,
                preferredPhone: userData.preferredPhone,
                birthday: userData.birthday,
                halfBirthday: userData.halfBirthday,
                optInCreativeRealEstate: userData.optInCreativeRealEstate,
                optInFrisbeeNotices: userData.optInFrisbeeNotices,
                optInCcsnUpdates: userData.optInCcsnUpdates,
                onlyRecentEvents: userData.onlyRecentEvents,
                adminNotes: userData.adminNotes,
            },
        }
    );
    const user = await getUser(userId);
    return user;
};

const updateAdminNotes = async (userId, adminNotes) => {
    helpers.isValidId(userId);
    const notes = helpers.optionalString(adminNotes, 'Admin notes');
    const userCollection = await users();
    const result = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { adminNotes: notes } });
    if (!result.matchedCount) throw 'Could not update admin notes';
    return getUser(userId);
};

const editPfp = async (userId, imagePath) => {
    const user = await getUser(userId);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';

    const url = `${base}/${bucketName}/${userId}/${imagePath}`;
    await editUser(
        userId,
        user.username,
        user.emailAddress,
        url,
        user.description,
        user.skills,
        user.name,
        user.link1,
        user.link1desc,
        user.link2,
        user.link2desc,
        user.statement || '',
        user.additionalDescription || '',
        user.slideshowDescription || '',
        user.visibility || 'public',
        user.privateDescription || '',
        user.preferredEmail || '',
        user.preferredPhone || '',
        user.birthday || '',
        user.halfBirthday || '',
        !!user.optInCreativeRealEstate,
        !!user.optInFrisbeeNotices,
        !!user.optInCcsnUpdates,
        user.adminNotes || '',
        user.statement2 || '',
        user.link3 || '',
        user.link3desc || '',
        user.link4 || '',
        user.link4desc || '',
        !!user.onlyRecentEvents
    );
};

const getAllUsers = async () => {
    const userCollection = await users();
    let userList = await userCollection.find({}).toArray();
    if (!userList) throw 'Could not get all events';
    userList = userList.map((element) => {
        element._id = element._id.toString();
        return element;
    });
    return userList;
};

const getUser = async (userId) => {
    // Input Validation
    if (!userId) throw 'User Id not given';
    if (typeof userId !== 'string') throw 'User Id is not a string';
    userId = userId.trim();
    if (!ObjectId.isValid(userId)) throw 'User Id is not valid';

    // Get all users
    const userCollection = await users();
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw 'Could not find user';
    }
    user._id = user._id.toString();
    if (user.statement == null) user.statement = '';
    if (user.statement2 == null) user.statement2 = '';
    if (user.additionalDescription == null) user.additionalDescription = '';
    if (user.slideshowDescription == null) user.slideshowDescription = '';
    if (user.link3 == null) user.link3 = '';
    if (user.link3desc == null) user.link3desc = '';
    if (user.link4 == null) user.link4 = '';
    if (user.link4desc == null) user.link4desc = '';
    if (user.onlyRecentEvents == null) user.onlyRecentEvents = false;
    if (user.birthday == null) user.birthday = '';
    if (user.halfBirthday == null) user.halfBirthday = '';
    return helpers.withVisibilityDefaults(user);
};

const deleteUser = async (userId) => {
    // Input Validation
    if (!userId) throw 'User Id not given';
    if (typeof userId !== 'string') throw 'User Id is not a string';
    userId = userId.trim();
    if (!ObjectId.isValid(userId)) throw 'User Id is not valid';

    const gameCollection = await games();
    const groupCollection = await groups();
    const userCollection = await users();

    // Remove user from all games
    const gameRemove = await gameCollection.updateMany(
        { players: userId },
        {
            $pull: { players: userId },
            $inc: { totalNumberOfPlayers: -1 },
        },
        { returnDocument: 'after' }
    );

    // Remove user from all games they are organizing
    const updateOrganizer = await gameCollection.updateMany({ organizer: userId }, { $set: { organizer: null } }, { returnDocument: 'after' });

    // Remove user from all groups they are leading
    const updateGroupLeader = await groupCollection.updateMany(
        { groupLeader: userId },
        {
            $set: {
                groupLeader: null,
            },
            $pull: {
                players: userId, // remove user,
            },
            $inc: { totalNumberOfPlayers: -1 },
        },
        { returnDocument: 'after' }
    );

    const groupRemove = await groupCollection.updateMany(
        { players: userId },
        {
            $pull: {
                players: userId, // remove user,
            },
            $inc: { totalNumberOfPlayers: -1 },
        },
        { returnDocument: 'after' }
    );

    const updateGroupMessages = await groupCollection.updateMany({}, { $pull: { comments: { userId: userId } } });
    const updateFriendRequests = await userCollection.updateMany({}, { $pull: { friendRequests: userId } });
    const updateFriendList = await userCollection.updateMany({}, { $pull: { friends: userId } });
    const userRemove = await userCollection.findOneAndDelete({ _id: new ObjectId(userId) }, { returnDocument: 'after' });
    if (
        !updateFriendList ||
        !updateFriendRequests ||
        !updateGroupMessages ||
        !gameRemove ||
        !updateGroupLeader ||
        !updateOrganizer ||
        !groupRemove ||
        !userRemove
    )
        throw 'Could not delete user';

    // Delete info from bucket
    await picturesData.deleteUserFolder(userId);

    return { gameRemove, groupRemove, userRemove };
};

export const loginUser = async (username, password) => {
    //Input Validation
    if (!username || !password) throw 'Error: 1 or more fields missing';
    if (typeof username !== 'string' || typeof password !== 'string') throw 'Expected a string';
    username = username.trim().toLowerCase();
    password = password.trim();
    if (username.length === 0 || password.length === 0) throw 'Cannot be empty spaces';
    //helpers.validatePassword(password);

    const userCollection = await users();
    const user = await userCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user) {
        throw 'Either password or username is invalid';
    }

    //Compare Passwords
    const compare = await bcrypt.compare(password, user.password);
    if (!compare) {
        throw 'Either password or username is invalid';
    }
    //I dont know what we want to return for this so currently return everything besides password feel free to change
    return {
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        emailAddress: user.emailAddress,
        description: user.description,
        profilePicture: user.profilePicture,
        friends: user.friends,
        games: user.games,
        groups: user.groups,
        friendRequests: user.friendRequests,
        skills: user.skills,
        isAdmin: !!(user.isAdmin || user.admin),
        link1: user.link1 || '',
        link1desc: user.link1desc || '',
        link2: user.link2 || '',
        link2desc: user.link2desc || '',
        link3: user.link3 || '',
        link3desc: user.link3desc || '',
        link4: user.link4 || '',
        link4desc: user.link4desc || '',
        statement: user.statement || '',
        statement2: user.statement2 || '',
        additionalDescription: user.additionalDescription || '',
        slideshowDescription: user.slideshowDescription || '',
        visibility: user.visibility || 'public',
        privateDescription: user.privateDescription || '',
        preferredEmail: user.preferredEmail || '',
        preferredPhone: user.preferredPhone || '',
        birthday: user.birthday || '',
        halfBirthday: user.halfBirthday || '',
        optInCreativeRealEstate: !!user.optInCreativeRealEstate,
        optInFrisbeeNotices: !!user.optInFrisbeeNotices,
        optInCcsnUpdates: !!user.optInCcsnUpdates,
        onlyRecentEvents: !!user.onlyRecentEvents,
        adminNotes: user.adminNotes || '',
    };
};

const sendFriendRequest = async (userId, friendUserId) => {
    // Input Validation
    helpers.isValidId(userId);
    helpers.isValidId(friendUserId);
    userId = userId.trim();
    friendUserId = friendUserId.trim();

    if (userId === friendUserId) throw 'Cannot send friend request to yourself';

    // Check if user is already a friend or has already an existing friend request
    const user = await getUser(userId);
    const otherUser = await getUser(friendUserId);

    if (user.friends.includes(friendUserId)) throw 'User already a friend';
    if (user.friendRequests.includes(friendUserId)) throw 'You have a pending friend request from this user';
    if (otherUser.friendRequests.includes(userId)) throw 'Already sent a friend request';

    // Update other user's friend requests
    const userCollection = await users();
    const updatedInfo = await userCollection.updateOne({ _id: new ObjectId(friendUserId) }, { $push: { friendRequests: userId } });

    if (!updatedInfo) throw 'Could not update user successfully';

    return updatedInfo;
};

const acceptFriendRequest = async (userId, friendUserId) => {
    // Input Validation
    helpers.isValidId(userId);
    helpers.isValidId(friendUserId);
    userId = userId.trim();
    friendUserId = friendUserId.trim();

    // Check if there is a request to accept
    const userCollection = await users();
    const user = await getUser(userId);

    if (!user.friendRequests.includes(friendUserId)) throw 'User does not have a pending friend request from this user';

    // Update friends for both users
    const selfUpdatedInfo = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
            $push: { friends: friendUserId },
            $pull: { friendRequests: friendUserId },
        }
    );
    const friendUpdatedInfo = await userCollection.updateOne({ _id: new ObjectId(friendUserId) }, { $push: { friends: userId } });

    if (!selfUpdatedInfo || !friendUpdatedInfo) throw 'Could not update user(s) successfully';

    return selfUpdatedInfo;
};

const rejectFriendRequest = async (userId, friendUserId) => {
    // Input Validation
    helpers.isValidId(userId);
    helpers.isValidId(friendUserId);
    userId = userId.trim();
    friendUserId = friendUserId.trim();

    // Check if there is a request to reject
    const userCollection = await users();
    const user = await getUser(userId);

    if (!user.friendRequests.includes(friendUserId)) throw 'User does not have a pending friend request from this user';

    // Remove friend request
    const updatedInfo = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $pull: { friendRequests: friendUserId } });

    if (!updatedInfo) throw 'Could not update user successfully';

    return updatedInfo;
};

const removeFriend = async (userId, friendUserId) => {
    // Input Validation
    helpers.isValidId(userId);
    helpers.isValidId(friendUserId);
    userId = userId.trim();
    friendUserId = friendUserId.trim();

    const userCollection = await users();

    // Check if user is a friend
    const user = await getUser(userId);
    if (!user.friends.includes(friendUserId)) throw 'User is not a friend';

    // Remove friend from both users
    const selfUpdatedInfo = await userCollection.updateOne({ _id: new ObjectId(userId) }, { $pull: { friends: friendUserId } });
    const friendUpdatedInfo = await userCollection.updateOne({ _id: new ObjectId(friendUserId) }, { $pull: { friends: userId } });

    if (!selfUpdatedInfo || !friendUpdatedInfo) throw 'Could not update user(s) successfully';

    return selfUpdatedInfo;
};

const isUserLeader = async (userId) => {
    //Returns True if user is owner of at least one game or group otherwise False
    helpers.isValidId(userId);
    const gameCollection = await games();
    const groupCollection = await groups();
    const gameOrganizer = await gameCollection.findOne({ organizer: userId });
    if (gameOrganizer) {
        return true;
    }
    const groupLeader = await groupCollection.findOne({ groupLeader: userId });
    if (groupLeader) {
        return true;
    }
    return false;
};

/**
 *
 * @param {string} userId
 * @returns Boolean representing if user is an admin
 */
const isUserAdmin = async (userId) => {
    helpers.isValidId(userId);
    const user = await getUser(userId);
    if (user.admin || user.isAdmin) {
        return true;
    }

    return false;
};

/**
 *
 * @param {string} userId
 * @param {string} imagePath - /type/imageName/imageNum
 * @returns {object}
 */
const addSlideshowImage = async (userId, imagePath) => {
    helpers.isValidId(userId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${userId}/${imagePath}`;
    const slide = { url, caption: helpers.captionFromImageUrl(url) };

    const userCollection = await users();
    const updatedInfo = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { slideshowImages: slide } }
    );

    if (!updatedInfo) throw 'Could not update user successfully';

    return updatedInfo;
};

const removeSlideshowImage = async (userId, imagePath) => {
    helpers.isValidId(userId);
    helpers.stringHelper(imagePath, 'Image Path', 1, 100);

    const bucketName = process.env.BUCKET_NAME;
    const base = 'https://storage.googleapis.com';
    const url = `${base}/${bucketName}/${userId}/${imagePath}`;

    const user = await getUser(userId);
    const next = helpers
        .normalizeSlideshowSlides(user.slideshowImages || [])
        .filter((slide) => slide.url !== url);

    const userCollection = await users();
    const updatedInfo = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { slideshowImages: next } }
    );

    if (!updatedInfo) throw 'Could not update user successfully';

    return updatedInfo;
};

const updateSlideshowCaption = async (userId, imageUrl, caption) => {
    helpers.isValidId(userId);
    helpers.stringHelper(imageUrl, 'Image URL', 1, 2048);
    const nextCaption = helpers.optionalString(caption, 'Caption', 200);

    const user = await getUser(userId);
    const slides = helpers.normalizeSlideshowSlides(user.slideshowImages || []);
    let found = false;
    const next = slides.map((slide) => {
        if (helpers.slideshowUrlsMatch(slide.url, imageUrl)) {
            found = true;
            return { url: slide.url, caption: nextCaption };
        }
        return slide;
    });
    if (!found) throw 'Slideshow image not found';

    const userCollection = await users();
    const updatedInfo = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { slideshowImages: next } }
    );
    if (!updatedInfo) throw 'Could not update caption';
    return updatedInfo;
};

export default {
    createUser,
    getAllUsers,
    getUser,
    deleteUser,
    editUser,
    editPfp,
    updateAdminNotes,
    loginUser,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getIDName,
    isUserLeader,
    addSlideshowImage,
    removeSlideshowImage,
    updateSlideshowCaption,
    isUserAdmin,
};
