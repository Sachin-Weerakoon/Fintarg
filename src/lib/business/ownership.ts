import { prisma } from "@/lib/db";

export class BusinessOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessOwnershipError";
  }
}

export async function assertOwnsBusiness(
  userId: string,
  businessId: string
): Promise<void> {
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!business) {
    throw new BusinessOwnershipError("Business not found or access denied");
  }
}

export async function assertBranchInBusiness(
  userId: string,
  businessId: string,
  branchId: string
): Promise<void> {
  await assertOwnsBusiness(userId, businessId);

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!branch) {
    throw new BusinessOwnershipError("Branch not found or does not belong to this business");
  }
}

export async function getOwnedBusinesses(userId: string) {
  return prisma.business.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOwnedBranches(userId: string, businessId: string) {
  await assertOwnsBusiness(userId, businessId);
  return prisma.branch.findMany({
    where: { businessId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOwnedBusinessOrThrow(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
  });
  if (!business) throw new BusinessOwnershipError("Business not found or access denied");
  return business;
}

export async function getOwnedBranchOrThrow(userId: string, businessId: string, branchId: string) {
  await assertOwnsBusiness(userId, businessId);
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, businessId, deletedAt: null },
  });
  if (!branch) throw new BusinessOwnershipError("Branch not found or does not belong to this business");
  return branch;
}