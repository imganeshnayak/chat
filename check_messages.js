import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const escrowMessages = await prisma.message.findMany({
        where: {
            messageType: {
                in: ['escrow_created', 'escrow_payment']
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log('--- Escrow Messages found: ---');
    console.log(JSON.stringify(escrowMessages, null, 2));

    const allMessageTypes = await prisma.message.groupBy({
        by: ['messageType'],
        _count: true
    });
    console.log('--- Message Type Counts: ---');
    console.log(JSON.stringify(allMessageTypes, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
