import { $ } from "bun";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import crypto from "crypto";

const STAGING_DIR = join("dist", "staging");
const DIST_DIR = "dist";

// Parse arguments & environment variables
let token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.PAT;
let gitTag = "";

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg) continue;

  if (arg === "--token" || arg === "-t") {
    token = process.argv[i + 1] || "";
    i++;
  } else if (!arg.startsWith("-")) {
    gitTag = arg;
  }
}

// Fail early if no token is defined
if (!token) {
  console.error("❌ Error: GitHub Personal Access Token (PAT) is not defined!");
  console.error("💡 Please set GITHUB_TOKEN, GITHUB_PAT, or PAT env variable, or pass it via: --token <PAT> / -t <PAT>");
  process.exit(1);
}

// Fail early if no Git tag can be determined
if (!gitTag) {
  gitTag = (await $`git describe --tags --abbrev=0 2>/dev/null`.nothrow().text()).trim();
}

if (!gitTag) {
  console.error("❌ Error: No Git tag provided or found.");
  console.info("💡 To create a release on GitHub, tag your repository first:");
  console.info("   git tag -a v1.0.0 -m \"Release v1.0.0\"");
  console.info("   bun run release v1.0.0");
  process.exit(1);
}

// Helper to parse GitHub remote owner and repository
function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const match = url.match(/github\.com[:/]([^/]+)\/([^.]+)(?:\.git)?/);

  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, "")
    };
  }

  return null;
}

// Clean previous build staging and archive files
console.log("🧹 Cleaning staging and old archives...");
await $`bun run build:clean`;

if (existsSync(STAGING_DIR)) {
  rmSync(STAGING_DIR, { recursive: true, force: true });
}

// Build all binaries
console.log("🏗️ Compiling standalone binaries for all platforms...");
await $`bun run build:all`;

// Setup files to bundle
const filesToBundle = ["README.md", "LICENSE", ".env.example"];
for (const file of filesToBundle) {
  if (!existsSync(file)) {
    console.error(`❌ Error: ${file} is missing!`);
    process.exit(1);
  }
}

// Archive configuration mapping (zipped for maximum platform compatibility)
const targets = [
  {
    binary: "ssl-checker-linux-64-bit",
    archive: "ssl-checker-linux-64-bit.zip",
    binName: "ssl-checker"
  },
  {
    binary: "ssl-checker-linux-arm64",
    archive: "ssl-checker-linux-arm64.zip",
    binName: "ssl-checker"
  },
  {
    binary: "ssl-checker-macos-64-bit",
    archive: "ssl-checker-macos-64-bit.zip",
    binName: "ssl-checker"
  },
  {
    binary: "ssl-checker-macos-arm64",
    archive: "ssl-checker-macos-arm64.zip",
    binName: "ssl-checker"
  },
  {
    binary: "ssl-checker-windows-64-bit.exe",
    archive: "ssl-checker-windows-64-bit.zip",
    binName: "ssl-checker.exe"
  }
];

const archivesCreated: string[] = [];

console.log("📦 Creating release archives...");
for (const target of targets) {
  const binaryPath = join(DIST_DIR, target.binary);
  if (!existsSync(binaryPath)) {
    console.warn(`⚠️ Warning: Binary not found at ${binaryPath}. Skipping.`);
    continue;
  }

  const platformStaging = join(STAGING_DIR, target.archive.replace(/\.zip$/, ""));
  mkdirSync(platformStaging, { recursive: true });

  // Copy binary renamed to simple name (e.g. ssl-checker or ssl-checker.exe)
  copyFileSync(binaryPath, join(platformStaging, target.binName));

  // Copy standard packaging metadata files
  for (const file of filesToBundle) {
    copyFileSync(file, join(platformStaging, file));
  }

  const archiveOutPath = join(DIST_DIR, target.archive);

  // Compress using zip
  await $`zip -q -j ${archiveOutPath} ${platformStaging}/*`;

  archivesCreated.push(target.archive);
  console.log(`✅ Created archive: ${archiveOutPath}`);
}

// Generate Checksum file
console.log("🔒 Calculating SHA-256 checksums...");

let checksumContent = "";
for (const archive of archivesCreated) {
  const archivePath = join(DIST_DIR, archive);
  const fileBuffer = readFileSync(archivePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  checksumContent += `${hash}  ${archive}\n`;
}

const checksumFile = join(DIST_DIR, "checksum.txt");
writeFileSync(checksumFile, checksumContent);
console.log(`✅ Generated checksums file: ${checksumFile}`);

// Clean up staging directory
await $`rm -rf ${STAGING_DIR}`;

// Push to GitHub Releases
console.log(`🚀 Creating GitHub Release for tag: ${gitTag}...`);
try {
  const remoteUrl = (await $`git remote get-url origin 2>/dev/null`.nothrow().text()).trim();
  const parsed = parseGithubRemote(remoteUrl);

  if (!parsed) {
    console.error(`❌ Error: Could not determine GitHub owner and repository from remote URL: "${remoteUrl}"`);
    process.exit(1);
  }

  const { owner, repo } = parsed;

  console.log(`📡 Connecting to GitHub API for repository: ${owner}/${repo}...`);

  // Generate Changelog
  console.log("📝 Generating changelog from git history...");

  let changelog = "";
  try {
    const tags = (await $`git tag --sort=-v:refname`.nothrow().text()).trim().split("\n").filter(Boolean);
    const currentTagIndex = tags.indexOf(gitTag);

    if (currentTagIndex !== -1 && currentTagIndex < tags.length - 1) {
      const prevTag = tags[currentTagIndex + 1];
      changelog = (await $`git log --oneline ${prevTag}..${gitTag}`.nothrow().text()).trim();
    } else {
      changelog = (await $`git log --oneline -n 10`.nothrow().text()).trim();
    }
  } catch (e) {
    changelog = "Initial release.";
  }

  // Create Release
  const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "Bun-Release-Script"
    },
    body: JSON.stringify({
      tag_name: gitTag,
      name: gitTag,
      body: `## Changelog\n${changelog}`,
      draft: false,
      prerelease: false,
      generate_release_notes: false
    })
  });

  if (!releaseResponse.ok) {
    const errText = await releaseResponse.text();
    console.error(`❌ Failed to create release: HTTP ${releaseResponse.status} - ${errText}`);
    process.exit(1);
  }

  const releaseData = (await releaseResponse.json()) as { id: number };
  const releaseId = releaseData.id;
  console.log(`✅ Release created successfully with ID: ${releaseId}`);

  // Upload assets
  const assets = [
    ...archivesCreated.map(a => ({ name: a, path: join(DIST_DIR, a) })),
    { name: "checksum.txt", path: checksumFile }
  ];

  for (const asset of assets) {
    console.log(`📤 Uploading asset ${asset.name}...`);
    const fileData = readFileSync(asset.path);

    const uploadResponse = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${asset.name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": fileData.byteLength.toString(),
        "User-Agent": "Bun-Release-Script"
      },
      body: fileData
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error(`❌ Failed to upload asset ${asset.name}: HTTP ${uploadResponse.status} - ${errText}`);
      process.exit(1);
    }

    console.log(`✅ Uploaded ${asset.name} successfully!`);
  }

  console.log(`🎉 GitHub Release successfully published for ${gitTag}!`);
} catch (err) {
  console.error("❌ Failed to push release to GitHub:", err);
  process.exit(1);
}
