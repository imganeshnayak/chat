import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
    console.log("🚀 Starting moderation verification...");

    try {
        // 1. Create dummy users for testing if they don't exist
        const userA = await prisma.user.upsert({
            where: { username: "test_user_a" },
            update: {},
            create: { username: "test_user_a", email: "a@test.com", password: "password", displayName: "User A" }
        });

        const userB = await prisma.user.upsert({
            where: { username: "test_user_b" },
            update: {},
            create: { username: "test_user_b", email: "b@test.com", password: "password", displayName: "User B" }
        });

        console.log(`✅ Users verified: ${userA.username} (ID: ${userA.id}), ${userB.username} (ID: ${userB.id})`);

        // 2. Test Blocking
        console.log("🔍 Testing Block logic...");
        const block = await prisma.blockedUser.upsert({
            where: { blockerId_blockedId: { blockerId: userA.id, blockedId: userB.id } },
            update: {},
            create: { blockerId: userA.id, blockedId: userB.id }
        });
        console.log("✅ Block created successfully.");

        // Check block exists
        const checkBlock = await prisma.blockedUser.findUnique({
            where: { blockerId_blockedId: { blockerId: userA.id, blockedId: userB.id } }
        });
        if (!checkBlock) throw new Error("Block verification failed.");
        console.log("✅ Block verified in database.");

        // 3. Test Reporting
        console.log("🔍 Testing Report logic...");
        const report = await prisma.report.create({
            data: {
                reporterId: userA.id,
                reportedId: userB.id,
                reason: "Test report reason for verification."
            }
        });
        console.log(`✅ Report created successfully (ID: ${report.id}).`);

        const checkReport = await prisma.report.findUnique({ where: { id: report.id } });
        if (!checkReport) throw new Error("Report verification failed.");
        console.log("✅ Report verified in database.");

        // 4. Test Chat Clear (partial check)
        console.log("🔍 Testing Chat Clear logic...");
        // Create a dummy message
        const dummyMsg = await prisma.message.create({
            data: {
                senderId: userA.id,
                receiverId: userB.id,
                chatId: "test_chat_id",
                content: "Temporary message for clear test"
            }
        });
        console.log("✅ Dummy message created.");

        await prisma.message.deleteMany({ where: { chatId: "test_chat_id" } });
        const msgAfterClear = await prisma.message.findFirst({ where: { chatId: "test_chat_id" } });
        if (msgAfterClear) throw new Error("Clear history failed.");
        console.log("✅ Chat history clearing verified.");

        // Cleanup
        await prisma.blockedUser.delete({ where: { id: block.id } });
        await prisma.report.delete({ where: { id: report.id } });
        console.log("🧹 Cleanup complete.");

        console.log("✨ All moderation backend checks PASSED!");
    } catch (err) {
        console.error("❌ Verification failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

runTests();
