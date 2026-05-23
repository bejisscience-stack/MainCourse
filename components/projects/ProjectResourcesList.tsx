"use client";

import { useI18n } from "@/contexts/I18nContext";
import type { ProjectResource } from "@/hooks/useActiveProjects";
import { ProjectResourceMedia } from "@/components/projects/ProjectResourceMedia";

interface ProjectResourcesListProps {
  projectId: string;
  resources: ProjectResource[];
}

export default function ProjectResourcesList({
  projectId,
  resources,
}: ProjectResourcesListProps) {
  const { t } = useI18n();

  if (!resources.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-4">
        {t("projects.resourcesTitle")}
      </h2>
      <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-4">
        {t("projects.resourcesDescription")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => (
          <ProjectResourceMedia
            key={resource.id}
            projectId={projectId}
            resourceType={resource.resource_type}
            url={resource.url}
            title={resource.title}
          />
        ))}
      </div>
    </section>
  );
}
