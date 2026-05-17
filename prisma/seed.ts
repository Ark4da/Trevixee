import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@trascend.local" },
  });
  if (!existing) {
    const hash = await bcrypt.hash("Admin123!", 10);
    await prisma.user.create({
      data: {
        email: "admin@trascend.local",
        name: "Trader",
        password: hash,
        provider: "credentials",
      },
    });
    console.log("Default dev user created: admin@trascend.local / Admin123!");
  } else {
    console.log("Dev user already exists.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
