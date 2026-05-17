-- P2 local fixes: mark mentor-pushed playbooks as read-only.
ALTER TABLE "Playbook" ADD COLUMN "isReadOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Playbook" ADD COLUMN "sourcePlaybookId" TEXT;
ALTER TABLE "Playbook" ADD COLUMN "pushedByUserId" TEXT;
ALTER TABLE "Playbook" ADD COLUMN "pushedAt" TIMESTAMP(3);
