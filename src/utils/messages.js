const { v4: uuidv4 } = require('uuid');

const generateMessage = (msg, username, readStatus = '') => {
    const date = new Date().getTime();
    const name = username?.slice(0, 1).toUpperCase() + username?.slice(1);
    return {
        msg,
        username: name,
        createAt: date,
        id: uuidv4(),
        readStatus
    };
};

const generateLocationMessage = (url, username, readStatus = '') => {
    const date = new Date().getTime();
    const name = username?.slice(0, 1).toUpperCase() + username?.slice(1);

    return {
        url,
        username: name,
        createAt: date,
        readStatus
    };
};

module.exports = {
    generateMessage,
    generateLocationMessage
};