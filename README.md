# 🔒 SSL Checker CLI

Welcome to the future of SSL auditing! **SSL Checker CLI** is an ultra-fast, modern, and highly insightful CLI tool built with **Bun** and **TypeScript** to audit, monitor, and report the SSL/TLS certificate status of multiple domains. 🐹✨

This utility utilizes low-level Node TLS connection sockets to probe endpoints, fetching precise expiration dates and calculating remaining valid days, then rendering everything into a beautiful, perfectly-aligned console table.

---

## ✨ Why SSL Checker CLI?

*   **⚡ Blazing Fast Auditing:** Leverages the high-performance **Bun** runtime and Node.js native `tls` sockets for asynchronous domain auditing.
*   **📊 Pristine CLI UI:** Draws clean, high-contrast console tables using Unicode box-drawing characters (`┌`, `├`, `└`, etc.).
*   **✨ Emoji-Aware Alignment:** Solves the classic terminal alignment bug where multi-byte emojis throw off column widths.
*   **🎯 Dynamic File Reading:** Reads domains line-by-line dynamically from any provided text file.
*   **🚦 Intelligent Health Categorization:**
    *   `✅ SAFE` — Certificate is valid with remaining days greater than the warning threshold (default: **> 14 days**).
    *   `⚠️ UPDATE SOON` — Certificate is active but expiring within the warning threshold (default: **≤ 14 days**).
    *   `🔴 EXPIRED` — Certificate has expired.
    *   `❌ INVALID` — Certificate is active but belongs to a different domain (hostname mismatch).
    *   `❌ CERTIFICATE ERROR` — Host is reachable, but certificate is invalid or empty.
    *   `❌ ERROR` — Connection failed (DNS issues, port blocked, offline host).
    *   `⏱️ TIMEOUT` — Connection timed out (default: **5-second** limit, customizable via env).
*   **⚙️ Configuration & Env Tweak:** Native support for loading parameters from environment variables (`.env`) for extreme configurability.
*   **📦 Standalone Compilations:** Packaged and optimized into self-contained binaries for Linux, macOS, and Windows (supporting both 64-bit and ARM64 architectures).
*   **💨 Memory Footprint Optimization:** Compiled with `--smol` optimization for aggressive garbage collection and minimal memory usage in lightweight environments.

---

## 🚀 Getting Started

### 📋 Prerequisites

*   **Bun** (1.0+)

---

## 🛠️ Deployment

### 📦 **Using Pre-Built Binaries**

Pre-compiled standalone binaries for all supported platforms are available on the GitHub Release page:

👉 **[Download Pre-Built Binaries](https://github.com/dimaskiddo/ssl-checker-cli/releases)**

You can run these standalone binaries immediately without having any dependencies (including Bun or Node) installed on your system.

> [!NOTE]
> **Architecture Compatibility**: Bun is exclusively a high-performance **64-bit runtime**, which means compiling to 32-bit (x86) targets is not supported. All generated binaries are built for 64-bit architectures.
>
> **Memory Optimization (`--smol`)**: To minimize memory footprints in lightweight or serverless environments, all compiled binaries embed the `--smol` flag. This configures the engine to use a small JavaScriptCore heap, forcing the garbage collector to run aggressively.

#### 🐧 **Linux / 🍎 macOS**
```bash
# Give it execution power
chmod +x ssl-checker-linux-64-bit

# Run the auditor
./ssl-checker-linux-64-bit domain.txt
```

#### 🪟 **Windows**
*(Run from an Administrator Command Prompt or PowerShell)*
```powershell
.\ssl-checker-windows-64-bit.exe domain.txt
```

### 🏗️ **Build From Source**

```bash
git clone https://github.com/dimaskiddo/ssl-checker-cli.git
cd ssl-checker-cli

# Install dependencies (only types required)
bun install

# Compile standalone executable for your current OS
bun run build

# Cross-compile for all target platforms (Linux, macOS, Windows)
# Generated binaries are located in the dist/ folder
bun run build:all

# Clean previous builds
bun run build:clean
```

---

## 🕹️ Usage & Commands

LMD-style target scanning is managed via a simple and powerful CLI:

### 📝 Prepare Domain List
Create a text file containing target domains (one per line), e.g., `domain.txt`:
```text
example.com
expired.example.com
api.example.com
```

### 🚀 Running the CLI
Run the auditor using Bun directly or from your compiled binary:

*   **`bun check-ssl <file>`**: Run the auditor directly from source.
*   **`./dist/ssl-checker <file>`**: Run the compiled local standalone binary.

### 📊 Example Report Output
```text
Checking SSL for a total of 4 domains from file [domain.txt]
┌──────┬─────────────────────────┬───────────────────┬─────────────────┬──────────────────────┐
│ No   │ Domain                  │ Expiration Date   │ Days Remaining  │ Status               │
├──────┼─────────────────────────┼───────────────────┼─────────────────┼──────────────────────┤
│ 1    │ example.com             │ 15-06-2026        │ 26 days         │ ✅ SAFE              │
│ 2    │ expired.example.com     │ 10-05-2026        │ 10 days ago     │ 🔴 EXPIRED           │
│ 3    │ api.example.com         │ 28-05-2026        │ 8 days          │ ⚠️ UPDATE SOON       │
│ 4    │ invalid.example.com     │ -                 │ -               │ ❌ INVALID           │
└──────┴─────────────────────────┴───────────────────┴─────────────────┴──────────────────────┘
```

---

## ⚙️ Configuration & Environment Variables

Bun has native support for reading `.env` files. You can configure the auditor's behaviors without touching any code by creating a `.env` file in the root directory:

```bash
# Create a local environment file from example
cp .env.example .env
```

### Supported Variables

| Variable | Description | Default |
|---|---|---|
| `SSL_CHECK_PORT` | The port to perform TLS handshakes on. | `443` |
| `SSL_CHECK_TIMEOUT` | Timeout limit in milliseconds before dropping a connection. | `5000` (5 seconds) |
| `SSL_CHECK_WARN_DAYS` | Threshold (in days) to trigger the `⚠️ UPDATE SOON` status. | `14` (days) |

---

## ✍️ Authors

*   **Dimas Restu Hidayanto** - *Initial Work & Architecture* - [DimasKiddo](https://github.com/dimaskiddo)

---

## 🏗️ Built With Love & Power

*   **[Bun](https://bun.sh/)** - High-performance JavaScript runtime, bundler, and compiler.
*   **[TypeScript](https://www.typescriptlang.org/)** - For robust type safety.

---

## ⚠️ Disclaimer

**DO WITH YOUR OWN RISK (DWYOR)**. This software is provided "as is", without warranty of any kind, express or implied. Use of this software may involve risks, including but not limited to system instability or data loss. The authors are not responsible for any damage caused by the use of this application.

---

## ⚖️ License

Distributed under the **MIT License**. See `LICENSE` for more information.

---
**SSL Checker CLI** — *Pragmatic, beautiful, and ultra-fast TLS auditing.* 🔒🌐
