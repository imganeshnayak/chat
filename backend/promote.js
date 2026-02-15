import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteToAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address. Example: node promote.js user@example.com');
        process.exit(1);
    }

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'admin' },
        });
        console.log(`Successfully promoted ${user.displayName} (@${user.username}) to ADMIN.`);
    } catch (error) {
        console.error('Error promoting user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

promoteToAdmin();
