import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default function setupSocket(io) {
    const onlineUsers = new Map();

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        socket.on('join', async ({ userId, chatId }) => {
            try {
                // Verify user role from DB for security
                const user = await prisma.user.findUnique({
                    where: { id: parseInt(userId) },
                    select: { role: true }
                });

                if (user) {
                    onlineUsers.set(userId, socket.id);
                    socket.join(chatId);
                    socket.join(`user_${userId}`); // Join personal room for notifications

                    // If admin, join the admin broadcast room
                    if (user.role === 'admin') {
                        socket.join('admin_broadcast');
                        console.log(`🛡️ Admin ${userId} joined admin_broadcast room`);
                    }

                    io.emit('userOnline', { userId, online: true });
                    console.log(`👤 User ${userId} joined chat ${chatId} and personal room`);
                }
            } catch (err) {
                console.error('Socket join error:', err);
            }
        });

        socket.on('message', async (data) => {
            const { sender_id, receiver_id, chat_id, content, message_type } = data;

            try {
                const message = await prisma.message.create({
                    data: { senderId: sender_id, receiverId: receiver_id, chatId: chat_id, content, messageType: message_type || 'text' },
                    include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } },
                });

                const result = {
                    ...message,
                    sender_name: message.sender.displayName,
                    sender_avatar: message.sender.avatarUrl,
                    sender_username: message.sender.username,
                };

                io.to(chat_id).emit('newMessage', result);

                await prisma.activityLog.create({ data: { userId: sender_id, action: 'Sent message' } });
            } catch (err) {
                console.error('Socket message error:', err);
                socket.emit('error', { message: 'Failed to send message.' });
            }
        });

        socket.on('typing', ({ chatId, userId, isTyping }) => {
            socket.to(chatId).emit('userTyping', { userId, isTyping });
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    onlineUsers.delete(userId);
                    io.emit('userOnline', { userId, online: false });
                    break;
                }
            }
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
}
