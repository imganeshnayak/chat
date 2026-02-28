import { PrismaClient } from '@prisma/client'

async function renameDatabase() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://postgres:postgres@localhost:5433/postgres'
            }
        }
    })

    try {
        // Attempt to disconnect all users from vesper_chat first
        await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'vesper_chat' AND pid <> pg_backend_pid();
    `);

        // Rename database
        await prisma.$executeRawUnsafe('ALTER DATABASE vesper_chat RENAME TO krovaa_chat;');
        console.log('Database renamed to krovaa_chat');
    } catch (err) {
        console.error('Error renaming database:', err);
    } finally {
        await prisma.$disconnect()
    }
}

renameDatabase()
