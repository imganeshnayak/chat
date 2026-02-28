import { PrismaClient } from '@prisma/client'

async function testConnection() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://postgres:postgres@localhost:5433/krovaa_chat'
            }
        }
    })

    try {
        await prisma.$connect();
        console.log('Successfully connected to krovaa_chat');
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
    } catch (err) {
        console.error('Error connecting to krovaa_chat:', err);
    } finally {
        await prisma.$disconnect()
    }
}

testConnection()
