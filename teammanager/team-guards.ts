import { prisma } from './prisma';
import { ADMINISTRATOR_ROLE, ADMINISTRATOR_ROLE_LIMIT } from '../lib/constants';
import { APIError } from 'encore.dev/api';

export async function assertAdminCapNotReached(organizationId: string): Promise<void> {
  const adminCount = await prisma.member.count({
    where: { organizationId, role: ADMINISTRATOR_ROLE },
  });
  if (adminCount >= ADMINISTRATOR_ROLE_LIMIT) {
    throw APIError.failedPrecondition(
      `At most three administrators can belong to an organization.`,
    );
  }
}
