import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

import type { BattleScribeRepoData } from "~/assets/shared/battlescribe/bs_import_data";
import { removePrefix, removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import { XMLParser } from "fast-xml-parser";
import { unzip } from "unzipit";

export interface GithubIntegration {
  githubUrl: string;
  githubRepo?: string;
  githubOwner?: string;
  githubName?: string;
  repoData?: BattleScribeRepoData;
  discovered?: boolean;
}
const headers = {
  "Accept": "application/vnd.github.v3+json",
  "Content-type": "application/json; charset=UTF-8"
} as Record<string, string>;
if (globalThis.process?.env?.githubToken) {
  headers["Authorization"] = `Bearer ${process.env.githubToken}`;
}
const anonHeaders = {
  "Accept": "application/vnd.github.v3+json",
  "Content-type": "application/json; charset=UTF-8"
} as Record<string, string>;
if (globalThis.process?.env?.githubAnonToken) {
  anonHeaders["Authorization"] = `Bearer ${process.env.githubAnonToken}`;
}

function filename(path: string) {
  const split = path.replaceAll("\\", "/").split("/");
  return split[split.length - 1];
}

function throwIfError(response: { message?: string }) {
  if (response.message) throw new Error(response.message);
}
export function normalizeGithubRepoUrl(input: string): string | null {
  const githubUrlRegex = /^(?:(http(?:s?)?:\/\/)?github.com\/)?([^\/]+)\/([^\/]+)\/?.*$/;
  const match = input.match(githubUrlRegex);

  if (!match) {
    return null;
  }

  const [, protocol = "https://", user, repo] = match;

  if (!user || !repo) {
    return null;
  }
  return `https://github.com/${user}/${repo}`;
}
export function parseGitHubUrl(githubUrl: string) {
  // Regular expression to match GitHub URLs
  const githubUrlRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/)?$/;

  // Check if the input URL matches the GitHub URL format
  const match = githubUrl.match(githubUrlRegex);

  if (!match) {
    throw new Error("Invalid GitHub URL format: " + githubUrl);
  }

  const [, repoOwner, repoName] = match;

  return {
    githubUrl: githubUrl,
    githubRepo: `${repoOwner}/${repoName}`,
    githubOwner: repoOwner,
    githubName: repoName,
  };
}

async function getFileContentFromRepo(githubUrl: string, filePath: string) {
  try {
    const urlParts = githubUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1].replace(".git", "");
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;

    console.log(`Querying github api at ${url}`);
    const response = await $fetch<{ download_url?: string }>(url, {
      headers: {
        "User-Agent": "New Recruit Data Editor (Electron)",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response || !response?.download_url) {
      throw new Error("No download_url found");
    }
    console.log(`Downloading file at ${response?.download_url}`);

    const content = await $fetch<string>(response.download_url, {
      headers: {
        "User-Agent": "New Recruit Data Editor (Electron)",
        Accept: "application/vnd.github.v3+json",
      },
    });
    console.log(`Downloaded file, length: ${content.length}`);
    return content;
  } catch (error) {
    throw error;
  }
}
async function getFileContentFromRepoWithFallback(githubUrl: string, filePath: string, fallBackPath?: string) {
  try {
    return await getFileContentFromRepo(githubUrl, filePath);
  } catch (error) {
    if (!fallBackPath) {
      throw error;
    }
    return await getFileContentFromRepo(githubUrl, fallBackPath);
  }
}

export async function getNextRevision(github: GithubIntegration, catalogue: Catalogue) {
  if (catalogue.fullFilePath) {
    try {
      const fileName = filename(catalogue.fullFilePath);
      const fallBack = fileName.endsWith("z") ? removeSuffix(fileName, "z") : undefined;
      const content = await getFileContentFromRepoWithFallback(github.githubUrl, fileName, fallBack);
      const regex = /revision="(\d+)"/;
      const match = content.match(regex);
      if (match) {
        const resultRevision = (Number(match[1]) || 0) + 1;
        console.log(`Revision of ${catalogue.name}: ${catalogue.revision} -> ${resultRevision}`);
        return resultRevision;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return catalogue.revision || 1;
}
export async function fetchRef(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ ref: string | null; sha?: string; name?: string; date?: string }> {
  switch (ref) {
    case "latest-commit": {
      const { sha } = await getTree(owner, repo, "HEAD");
      return { ref: sha, sha: sha };
    }
    case "latest-tag":
    case "TAG_HEAD": {
      const tagsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers });
      const tags = await tagsResponse.json();
      throwIfError(tags);
      const latestTagSha = tags[0]?.commit?.sha;
      if (!latestTagSha) {
        throw new Error("Repo has no releases/tags, use latest commit (Head)");
      }
      return { ref: tags[0].name, name: tags[0].name, sha: latestTagSha };
    }
    case "latest-release-or-commit": {
      const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers });
      if (releaseResponse.status !== 404) {
        const release = await releaseResponse.json();
        throwIfError(release);
        const tag = release.tag_name;
        return { ref: tag, name: tag, date: release.published_at };
      }
      const { sha } = await getTree(owner, repo, "HEAD");
      return { ref: sha, sha };
    }
    case "latest-release-atom": {
      const atomResponse = await fetch(`https://github.com/${owner}/${repo}/releases.atom`);
      const atomXml = await atomResponse.text();
      function parseValue(str: string): any {
        switch (str) {
          case "true":
            return true;
          case "false":
            return false;
          default:
            if (isNaN(str as any)) return str;
            const float = parseFloat(str);
            if (isFinite(float) && str.includes("+") == false) return float;
            return str;
        }
      }
      const options = {
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        attributeNamePrefix: "",
        textNodeName: "$text",
        processEntities: false,
        parseTagValue: false,
        ignoreDeclaration: true,
        alwaysCreateTextNode: false,
        trimValues: false,
        isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
          return !isAttribute && ["entry", "link"].includes(tagName);
        },
        attributeValueProcessor: (name: string, val: string) => {
          return parseValue(unescape(val));
        },
        tagValueProcessor: (name: string, val: string) => {
          return unescape(val).trim();
        },
      };
      const parsed = new XMLParser(options).parse(atomXml);
      if (!parsed.feed?.entry?.length) {
        return { ref: null };
      } else {
        const entry = parsed.feed.entry[0];
        const tag = entry.id.split("/").pop();
        return { ref: tag, name: tag };
      }
    }
    case "latest-release":
    case "RELEASE_HEAD":
      const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers });
      const release = await releaseResponse.json();
      throwIfError(release);
      const tag = release.tag_name;
      return { ref: tag, name: tag, date: release.published_at };
    default:
      return { ref: ref };
  }
}
export async function getBlob(url: string,): Promise<string> {
  const resp = await fetch(url, { headers: { ...headers, Accept: "application/vnd.github.raw+json" } });
  if (!resp.ok) throw new Error(`Failed to fetch blob: ${resp.status}, url: ${url}`);
  const text = await resp.text();
  return text;
}
export async function getRawBlob(url: string): Promise<Blob> {
  const resp = await fetch(url, { headers: { ...headers, Accept: "application/vnd.github.raw+json" } });
  if (!resp.ok) throw new Error(`Failed to fetch blob: ${resp.status}, url: ${url}`);
  const text = await resp.blob();
  return text;
}
export async function getCommit(owner: string, repo: string, sha: string) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers });
  const json = await resp.json();
  throwIfError(json);
  return json;
}
export async function getCommitDate(owner: string, repo: string, sha: string) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers });
  const json = await resp.json();
  throwIfError(json);
  return json.commit.committer.date;
}
export async function getLatestCommitDate(
  owner: string,
  repo: string,
  path: string,
  commitSha: string,
  blobSha: string,
) {
  const apiUrlBase = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    // List commits affecting the file up to the commit resolved from the tag
    const response = await fetch(`${apiUrlBase}/commits?path=${path}&sha=${commitSha}`, { headers });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const commits = await response.json();
    throwIfError(commits);

    // Check each commit for the blob SHA (This part is not fully implemented here)
    for (let commit of commits) {
      let commitResponse = await fetch(`${apiUrlBase}/git/trees/${commit.sha}`, { headers });
      if (!commitResponse.ok) continue; // Skip on error
      let commitData = await commitResponse.json();
      throwIfError(commitData);

      // You would need to traverse the tree to find the file and check its blob SHA
      // This part is simplified and needs proper tree traversal depending on repository structure
      if (
        commitData.tree.some((entry: { path?: string; sha?: string }) => entry.path === path && entry.sha === blobSha)
      ) {
        return commit.commit.committer.date;
      }
    }
    return "No matching commit found";
  } catch (error) {
    console.error("Error fetching commit data:", error);
    return null;
  }
}

export interface GitTreeFile {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
  content?: string;
}

export interface GitTree {
  sha: string;
  url: string;
  truncated: boolean;
  tree: GitTreeFile[];
}

export async function getTree(owner: string, repo: string, ref: string): Promise<GitTree> {
  const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}`, { headers });
  const tree = await treeResponse.json();
  throwIfError(tree);
  return tree;
}

export async function starAndWatchRepo(owner: string, repo: string) {
  // Star the repository
  try {
    const response = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
      method: "PUT",
      headers,
    });
    if (response.status !== 204) {
      const json = await response.json();
      throwIfError(json);
    }
  } catch (error) {
    console.error(`Failed to star the repository ${owner}/${repo}:`, error);
  }

  // Watch the repository
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/subscription`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        subscribed: true,
        ignored: false,
      }),
    });
    const json = await response.json();
    throwIfError(json);
  } catch (error) {
    console.error(`Failed to watch the repository ${owner}/${repo}:`, error);
  }
}

export interface GithubNotification {
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  subject: {
    title: string;
    type: string;
  };
  reason: string;
  unread: boolean;
  updated_at: string;
  last_read_at: string;
  x_poll_interval?: number;
}

const NOT_MODIFIED = 304;
const SUCCESS = 200;
export async function getNotifications(since?: Date) {
  const sinceString = since ? since.toISOString() : undefined;

  const notificationHeaders = {} as Record<string, string>;
  const params = [] as string[];
  if (sinceString) {
    notificationHeaders["If-Modified-Since"] = sinceString;
    params.push(`since=${encodeURIComponent(sinceString)}`);
    params.push(`all=true`);
  } else {
    params.push(`all=false`);
  }
  const query = params.length ? `?${params.join("&")}` : "";
  const response = await fetch(`https://api.github.com/notifications${query}`, {
    headers: { ...headers, ...notificationHeaders },
  });
  const x_poll_interval = response.headers.get("X-Poll-Interval")
    ? Number(response.headers.get("X-Poll-Interval"))
    : null;
  if (response.status === NOT_MODIFIED) {
    return {
      notifications: [],
      x_poll_interval,
    }
  }
  const last_modified = new Date(response.headers.get("Last-Modified")!);
  const json = await response.json();
  throwIfError(json);
  if (response.status === SUCCESS) {
    if ((json as GithubNotification[]).length) {
      try {
        const mark_as_read_response = await fetch(`https://api.github.com/notifications`, {
          headers,
          method: "PUT",
          body: JSON.stringify({ last_read_at: new Date().toISOString(), read: true })
        })
      } catch (e) {
        console.error("Error in github.ts:getNotifications()", e);
      }
    }
  }
  return {
    notifications: json as GithubNotification[],
    x_poll_interval,
    last_modified,
  };
}
export class DynamicPoller {
  private interval: number;
  private timerId?: NodeJS.Timeout;
  private isPolling: boolean = false;

  constructor(initialInterval: number) {
    this.interval = initialInterval;
  }

  // Method to start the polling
  start(task: () => Promise<number | null | void | undefined>): void {
    if (this.isPolling) {
      this.stop();
    }
    this.isPolling = true;
    const executeTask = async () => {
      try {
        const newInterval = await task();
        if (typeof newInterval === "number") this.interval = newInterval;
      } catch (error) {
      } finally {
        if (this.isPolling) {
          this.timerId = setTimeout(executeTask, this.interval);
        }
      }
    };
    executeTask();
  }

  stop(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    this.isPolling = false;
  }
}

export async function getRepoZip(owner: string, name: string, ref: string = "HEAD") {
  // const tagUrl = `https://codeload.github.com/${owner}/${name}/legacy.zip/refs/tags/${ref}`
  // const headUrl = `https://codeload.github.com/${owner}/${name}/legacy.zip/refs/heads/${ref}`
  const tagUrl = `https://api.github.com/repos/${owner}/${name}/zipball/${ref}`
  const headUrl = `https://api.github.com/repos/${owner}/${name}/zipball/${ref}`


  let zipFile: Blob;
  try {
    zipFile = await $fetch<Blob>(`https://www.newrecruit.eu/api/proxy?url=${encodeURIComponent(tagUrl)}`)
  }
  catch (e) {
    zipFile = await $fetch<Blob>(`https://www.newrecruit.eu/api/proxy?url=${encodeURIComponent(headUrl)}`)
  }
  // Extract the useful files
  const folder = await unzip(zipFile);
  const entries = Object.entries(folder.entries)
  const root = entries[0][0]
  const result = entries.map(([k, v]) => [removePrefix(k, root), v]) as typeof entries
  return result
}


export async function createAnonymousIssue(repo: string, data: { title: string, body: string }) {
  const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    headers: anonHeaders,
    method: "POST",
    body: JSON.stringify({ ...data, title: `[Anon] ${data.title}` })
  })
  return await resp.json()
}


export async function proxyGithubReq(url: string, headers = {}) {
  const resp = await fetch(url, { headers: { Authorization: anonHeaders.Authorization, ...headers } })
  const result = await resp
  return result;
}