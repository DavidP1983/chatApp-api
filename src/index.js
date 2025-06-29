const express = require('express');
const path = require('path');
const cors = require('cors');
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

app.use(cors({
    origin: 'https://chat-app-virid-pi.vercel.app',
    methods: ['GET', 'POST']
}));

const server = createServer(app);
const io = new Server(server, {                 // SocketIO ожидает, что он будет вызван с помощью необработанного HTTP-сервера
    cors: {
        origin: 'https://chat-app-virid-pi.vercel.app',
        methods: ['GET', 'POST']
    }
});

const publicDirectory = path.resolve(__dirname, '../public');

app.use(express.static(publicDirectory));

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
            users: getUsersInRoom(user.room)
        });
        callback();

    });

    // --- Отображение прочитанных сообщений --- //

    socket.on('userActivity', ({ isActive }) => {   // Обрабатываем событие 
        const user = getUser(socket.id);

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


        const { readStatus } = visibilityStatus(user);  // Проверяем активность открытых вкладок

        io.to(user.room).emit('message', generateMessage(msg, user.username, readStatus));

        callback();                     // Сервер получил сообщение, можно передать аргумент
    });


    // --- Редактирование сообщений --- //

    socket.on('editMessage', ({ id, msg }, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();
        if (filter.isProfane(msg)) return callback('Profanity is not allowed');

        io.to(user.room).emit('messageUpdated', { id, msg });

        callback();
    });


    // --- Удаление сообщения --- //

    socket.on('deleteMessage', (id) => {
        const user = getUser(socket.id);
        io.to(user.room).emit('messageDeleted', { user: user.username, id });
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
                users: getUsersInRoom(user.room)
            });
        }
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, (error) => {
    error ? console.error(error) : console.log(`Listen PORT ${PORT}`);
});

