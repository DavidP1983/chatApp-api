// Все данные методы необходимы для того, чтоб мы могли обратиться к данным в любой части текущего кода 

const users = [];

const addUser = ({ id, username, room, imgURL, isActive }) => {
    username = username.trim().toLowerCase();
    room = room.trim().toLowerCase();

    // Validate the data
    if (!username || !room) {
        return {
            error: 'Username and room are required!'
        };
    }

    //Check for existing user no duplicates
    const existingUser = users.find((user) => user.room === room && user.username === username);

    // Validate user
    if (existingUser) {
        return {
            error: 'Username is in use!'
        };
    }

    //Store user
    const user = { id, username, room, imgURL, isActive };
    users.push(user);

    return { user };
};


// Remove a user
const removeUser = (id) => {
    // Это лучший способ удаления элемента из массива, так как если index найден, то операция поиска прекращается, в отличии от filter
    const index = users.findIndex((user) => user.id === id);

    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
};


// Get user
const getUser = (id) => {
    const user = users.find((user) => user.id === id);
    return user;

};


const normalize = (data) => data?.slice(0, 1).toUpperCase() + data?.slice(1);
const getUsersInRoom = (roomName) => {
    const usersInfo = users
        .filter((item) => item.room === roomName.toLowerCase())
        .map((item) => ({ ...item, username: normalize(item.username) }));
    const totalUsers = usersInfo.length;
    return { usersInfo, totalUsers, users };
};


module.exports = {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom
};