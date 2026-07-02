-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_teamId_fkey";

-- DropForeignKey
ALTER TABLE "teamMember" DROP CONSTRAINT "teamMember_teamId_fkey";

-- DropForeignKey
ALTER TABLE "teamMember" DROP CONSTRAINT "teamMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "team" DROP CONSTRAINT "team_organizationId_fkey";

-- DropIndex
DROP INDEX "invitation_teamId_idx";

-- DropIndex
DROP INDEX "session_activeTeamId_idx";

-- AlterTable
ALTER TABLE "invitation" DROP COLUMN "teamId";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "activeTeamId";

-- DropTable
DROP TABLE "teamMember";

-- DropTable
DROP TABLE "team";
