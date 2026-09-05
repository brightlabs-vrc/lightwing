-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_teamId_fkey";

-- DropForeignKey
ALTER TABLE "teamMember" DROP CONSTRAINT IF EXISTS "teamMember_teamId_fkey";

-- DropForeignKey
ALTER TABLE "teamMember" DROP CONSTRAINT IF EXISTS "teamMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "team" DROP CONSTRAINT IF EXISTS "team_organizationId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "invitation_teamId_idx";

-- DropIndex
DROP INDEX IF EXISTS "session_activeTeamId_idx";

-- AlterTable
ALTER TABLE "invitation" DROP COLUMN IF EXISTS "teamId";

-- AlterTable
ALTER TABLE "session" DROP COLUMN IF EXISTS "activeTeamId";

-- DropTable
DROP TABLE IF EXISTS "teamMember";

-- DropTable
DROP TABLE IF EXISTS "team";
