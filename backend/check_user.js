
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: {
            username: {
                contains: 'Megha',
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
    console.log('Found users:', JSON.stringify(users, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
