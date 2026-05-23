import type { ProjectResourceInput } from "@/components/chat/VideoUploadDialog";

export type StoredProjectResource = {
  type: "image" | "video" | "link";
  title?: string;
  url: string;
};

function isExternalUrl(value: string): boolean {
  return value.includes("://");
}

function resourceExtension(file: File, type: "image" | "video"): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  if (type === "image") return "jpg";
  return "mp4";
}

/** Upload resource files and return rows ready for project_resources insert. */
export async function prepareProjectResourcesForInsert(
  resources: ProjectResourceInput[] | undefined,
  uploadFile: (file: File, storagePath: string) => Promise<void>,
  buildStoragePath: (file: File, type: "image" | "video") => string,
): Promise<StoredProjectResource[]> {
  if (!resources?.length) return [];

  const stored: StoredProjectResource[] = [];

  for (const resource of resources) {
    if (resource.type === "link") {
      const url = resource.url?.trim();
      if (!url || !isExternalUrl(url)) continue;
      stored.push({
        type: "link",
        title: resource.title?.trim() || undefined,
        url,
      });
      continue;
    }

    if (resource.file) {
      const path = buildStoragePath(resource.file, resource.type);
      await uploadFile(resource.file, path);
      stored.push({
        type: resource.type,
        title: resource.title?.trim() || resource.file.name,
        url: path,
      });
    }
  }

  return stored;
}

export function resourceExtensionForFile(
  file: File,
  type: "image" | "video",
): string {
  return resourceExtension(file, type);
}

export function isStoragePath(value: string | null | undefined): boolean {
  return !!value && !value.includes("://");
}
