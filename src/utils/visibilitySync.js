const { getUsersInRoom } = require('./users');

const visibilityStatus = (user) => {
    const usersRoom = getUsersInRoom(user.room);
    const isVisible = usersRoom.users.every((item) => item.isActive === true);      // Проверяем активность открытых вкладок
    const readStatus = isVisible ? 'active' : '';

    return { readStatus };
};

module.exports = visibilityStatus;