const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const counts = await prisma.diagnosticTest.groupBy({ by: ['organizationId'], _count: { _all: true } });
  const active = await prisma.diagnosticTest.count({ where: { isActive: true } });
  const inactive = await prisma.diagnosticTest.count({ where: { isActive: false } });
  console.log('ORGS:', JSON.stringify(orgs, null, 2));
  console.log('TEST COUNTS BY ORG:', JSON.stringify(counts, null, 2));
  console.log('Active tests:', active, '| Inactive tests:', inactive);
  await prisma.$disconnect();
}

main().catch(console.error);