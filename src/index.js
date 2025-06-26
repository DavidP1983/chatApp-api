const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Filter = require('bad-words');

// Импортируем ф-ию которая, содержит все сообщения и timestamps
const { generateMessage, generateLocationMessage } = require('./utils/messages');

// Импортируем методы для работы с данными, которые будут доступны везде
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

// Импортируем ф-ию показа видимости сообщений
const visibilityStatus = require('./utils/visibilitySync');

const app = express();
const server = createServer(app);
const io = new Server(server); // SocketIO ожидает, что он будет вызван с помощью необработанного HTTP-сервера

const publicDirectory = path.resolve(__dirname, '../public');
// const createPath = (page) => path.resolve(__dirname, '../public', `${page}.html`);

app.use(express.static(publicDirectory));


// app.get('/', (req, res) => {
//     res.render(createPath("chat"));
// });


// ---  Socket io --- //
// server - to - client :
// socket.emit - отправление события только конкретному клиенту
// io.emit - отправляет событие каждому подключенному клиенту
// socket.broadcast.emit - отправляет событие каждому подключенному клиенту
// socket.join - позволяет нам присоединиться к заданной чат-комнате (это вариация между "io.emit ", "socket.broadcast " ), только к определенной комнате
// io.to.emit - отправляет событие всем, кто находится в определенной комнате.
// socket.broadcast.to.emit - отправка события всем, кроме конкретного клиента, но это ограничивает его определенным чатом
// socket.id - встроенный ф-нал

io.on('connection', (socket) => {
    console.log('The WebSocket connected');


    socket.on('join', (options, callback) => {                 // Socket Join позволяет нам присоединиться к заданной чат-комнате, только к определенной комнате.
        const { user, error } = addUser({ id: socket.id, ...options, isActive: true });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

        socket.emit('message', generateMessage(`Welcome! ${user.username}`, "Admin"));          // №1 Зашел новый пользователь. Отправляем ему сообщение, которое генерирует ф-ия и возвращает объект  
        socket.broadcast.to(user.room).emit('message', generateMessage(`${user.username} has joined!`, "Admin")); // №0 Отправление сообщения всем кроме себя в конкретной комнате - socket.broadcast

        // Комната посетителей, отображаем сколько пользователей в комнате
        const room = user.room?.slice(0, 1).toUpperCase() + user.room?.slice(1);
        io.to(user.room).emit('roomData', {
            room,
            imgURL: user.imgURL,
            img: user.filename,
            users: getUsersInRoom(user.room)
        });
        callback();

    });

    // --- Отображение прочитанных сообщений --- //

    socket.on('userActivity', ({ isActive }) => {   // Обрабатываем событие 
        const user = getUser(socket.id);

        // console.log(user);
        if (!user) return;                         // Если Пользователя нет, выбрасываем
        if (!isActive) {
            user.isActive = false;                // Если пользователь есть, но вкладка не активна
            return;
        }
        if (user && isActive) {                 // Если вкладка активна
            user.isActive = isActive;
            io.to(user.room).emit("userActivityUpdate", { isActive }); // Отправляем событие об активности вкладки
        }
    });


    // --- Отображения процесса печатания --- //

    socket.on('typing', () => {
        const user = getUser(socket.id);
        if (user) {
            socket.broadcast.to(user.room).emit('displayTyping', {
                username: user.username
            });
        }
    });

    socket.on('stopTyping', () => {
        const user = getUser(socket.id);
        if (user) {
            socket.broadcast.to(user.room).emit('hideTyping');
        }
    });

    // --- Отправка сообщений --- //

    socket.on('sendMessage', (msg, callback) => {                                   // №5 Сервер Получаем сообщение от пользователя

        const user = getUser(socket.id);
        const filter = new Filter();                                                // Проверка на плохие слова в чате
        if (filter.isProfane(msg)) return callback('Profanity is not allowed');   // Если в сообщении от пользователя содержится ненормативная лексика, отправляем сообщение об этом

        // io.to(user.room).emit('message', generateMessage(msg, user.username));         // №6 Отправляем данное сообщение всем пользователям конкретной комнаты

        const { readStatus } = visibilityStatus(user);  // Проверяем активность открытых вкладок

        io.to(user.room).emit('message', generateMessage(msg, user.username, readStatus));

        callback();                     // Сервер получил сообщение, можно передать аргумент
    });


    // --- Отправка локации --- //

    socket.on('sendLocation', (msg, callback) => {
        const user = getUser(socket.id);

        // Создали новый слушатель для локации
        const location = `https://google.com/maps?q=${msg.lat},${msg.lon}`;

        const { readStatus } = visibilityStatus(user);  // Проверяем активность открытых вкладок

        io.to(user.room).emit('locationMessage', generateLocationMessage(location, user.username, readStatus));
        callback('Location shared!');
    });



    // --- Выход из чата --- //

    socket.on('disconnect', () => {                              //№7 Пользователь покидает чат

        const user = removeUser(socket.id);

        if (user) {                                              // Отправляем сообщение о то, что пользователь покинул комнату, и проверка необходимо для того, чтоб отправить данное сообщение только в том случае, если это был участник данной комнаты
            io.to(user.room).emit('message', generateMessage(`${user.username} has left!`, "Admin"));

            const room = user.room?.slice(0, 1).toUpperCase() + user.room?.slice(1);
            io.to(user.room).emit('roomData', {
                room,
                imgURL: user.imgURL,
                img: user.filename,
                users: getUsersInRoom(user.room)
            });
        }
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, (error) => {
    error ? console.error(error) : console.log(`Listen PORT ${PORT}`);
});





// --- Old --- //

// io.on('connection', (socket) => {
//     console.log('The WebSocket connected');

//     socket.emit('message', 'Welcome!');                        // №1 Зашел новый пользователь
//     socket.broadcast.emit('message', 'A new user has joined!'); // №0 Отправление сообщения всем кроме себя


//     socket.on('sendMessage', (msg, callback) => {  // №5 Сервер Получаем сообщение от пользователя
//         const filter = new Filter();                // Проверка на плохие слова в чате
//         if (filter.isProfane(msg)) return callback('Profanity is not allowed');   // Если в сообщении от пользователя содержится ненормативная лексика, отправляем сообщение об этом

//         io.emit('message', msg);         // №6 Отправляем данное сообщение всем пользователям
//         callback();                     // Сервер получил сообщение, можно передать аргумент
//     });


//     socket.on('sendLocation', (msg, callback) => {
//         // Создали новый слушатель для локации
//         io.emit('locationMessage', `https://google.com/maps?q=${msg.lat},${msg.lon}`);
//         callback('Location shared!');
//     });

//     socket.on('disconnect', () => {             //№7 Пользователь покидает чат
//         io.emit('message', 'A user has left!');
//     });
// });


