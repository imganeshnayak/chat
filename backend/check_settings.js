import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'verification_fee' } });
    console.log('Verification Fee Setting:', setting);
    process.exit(0);
}

check();
