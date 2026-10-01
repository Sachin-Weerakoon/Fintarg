/**
 * Development seed: creates one Basic and one Business account with the worked
 * example from the specification already in place, so the app can be explored
 * without typing anything.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const CATEGORIES = ["Food", "Transport", "Utilities", "Personal/Enjoyment", "Medical", "Other"];

async function main() {
  const passwordHash = await hashPassword("fintarg123");

  const basic = await prisma.user.upsert({
    where: { email: "basic@fintarg.lk" },
    update: {},
    create: {
      email: "basic@fintarg.lk",
      passwordHash,
      edition: "basic",
      plan: "basic",
      profile: { create: { fullName: "Nimal Perera", mobile: "0771234567" } },
      categories: { create: CATEGORIES.map((name, index) => ({ name, sortOrder: index, isDefault: true })) },
    },
  });

  const business = await prisma.user.upsert({
    where: { email: "business@fintarg.lk" },
    update: {},
    create: {
      email: "business@fintarg.lk",
      passwordHash,
      edition: "business",
      plan: "business",
      profile: { create: { fullName: "Shanika Silva", mobile: "0779876543" } },
      categories: { create: CATEGORIES.map((name, index) => ({ name, sortOrder: index, isDefault: true })) },
      companies: {
        create: [
          {
            name: "Silva Trading Company",
            regNumber: "PV 00123456",
            address: "24 Galle Road, Colombo 04",
            phone: "0112345678",
            email: "hello@silvatrading.lk",
            accentColor: "#1d4ed8",
          },
        ],
      },
    },
  });

  // The specification's worked example, so the dashboard shows a shortfall.
  // Income 53,000 - living 28,000 - finance 25,000 - personal 5,000 = a
  // shortfall of exactly 5,000, with the Rs. 30,000 goal flagged as not
  // possible this month. The personal line is counted once (D2): the Rs. 5,000
  // spent against the Rs. 5,000 plan is one outflow term, not two.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const existing = await prisma.income.count({ where: { userId: basic.id } });
  if (existing === 0) {
    await prisma.income.createMany({
      data: [
        { userId: basic.id, sourceName: "Salary", kind: "salary", amountCents: 5_000_000, frequency: "monthly", date: start, recurring: true },
        { userId: basic.id, sourceName: "Tuition income", kind: "other", amountCents: 300_000, frequency: "monthly", date: start, recurring: true },
      ],
    });

    await prisma.expense.createMany({
      data: [
        { userId: basic.id, date: new Date(start.getFullYear(), start.getMonth(), 2), amountCents: 700_000, categoryName: "Food", recurring: true },
        { userId: basic.id, date: new Date(start.getFullYear(), start.getMonth(), 3), amountCents: 800_000, categoryName: "Transport" },
        { userId: basic.id, date: new Date(start.getFullYear(), start.getMonth(), 4), amountCents: 1_000_000, categoryName: "Utilities", recurring: true },
        { userId: basic.id, date: new Date(start.getFullYear(), start.getMonth(), 6), amountCents: 500_000, categoryName: "Personal/Enjoyment", isPersonal: true },
        { userId: basic.id, date: new Date(start.getFullYear(), start.getMonth(), 7), amountCents: 300_000, categoryName: "Medical", isMedical: true },
      ],
    });

    await prisma.financePayment.create({
      data: {
        userId: basic.id,
        lender: "Commercial Leasing",
        description: "Vehicle lease",
        amountCents: 2_500_000,
        dueDayOfMonth: 5,
        monthsRemaining: 18,
        startDate: start,
      },
    });

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: basic.id,
        name: "Emergency fund",
        targetAmountCents: 3_000_000,
        mode: "daily",
        dailyAmountCents: 100_000,
        monthlyTargetCents: 3_000_000,
      },
    });

    await prisma.contribution.create({
      data: { userId: basic.id, goalId: goal.id, amountCents: 200_000, note: "First deposit" },
    });

    await prisma.personalSpendingPlan.create({
      data: { userId: basic.id, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, plannedAmountCents: 500_000 },
    });
  }

  await prisma.agreement.create({
    data: {
      userId: business.id,
      title: "Shop rental agreement",
      otherParty: "Colombo Property Holdings",
      startDate: start,
      endDate: new Date(now.getFullYear(), now.getMonth() + 3, 30),
      valueCents: 3_600_000,
      status: "active",
      summary: "Monthly rent payable by the 5th. One month notice required to leave.",
    },
  }).catch(() => undefined);

  console.log("Seeded accounts:");
  console.log("  Basic   -> basic@fintarg.lk / fintarg123");
  console.log("  Business-> business@fintarg.lk / fintarg123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
