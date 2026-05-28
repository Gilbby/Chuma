import { groups as mockGroups } from "@/src/data/mock";
import { Group } from "@/src/types";

export async function getGroups(): Promise<Group[]> {
  return mockGroups;
}

export async function getGroupById(id: string): Promise<Group | undefined> {
  return mockGroups.find((g) => g.id === id);
}
