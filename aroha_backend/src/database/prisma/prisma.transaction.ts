import type { Prisma, PrismaClient } from "../../generated/prisma/client";

export type PrismaTransactionalClient = Prisma.TransactionClient | PrismaClient;
