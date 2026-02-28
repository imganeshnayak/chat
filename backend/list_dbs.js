import { PrismaClient } from '@prisma/client'

async function listDatabases() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://postgres:postgres@localhost:5433/postgres'
            }
        }
    })

    try {
        const result = await prisma.$queryRawUnsafe(`SELECT datname FROM pg_database WHERE datistemplate = false;`);
        console.log('Databases:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error listing databases:', err);
    } finally {
        await prisma.$disconnect()
    }
}

listDatabases()
