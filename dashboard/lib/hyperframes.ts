import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./paths";
import { supabaseAdmin } from "./supabase-admin";

export type HyperFramesVars = Record<string, string>;

export interface RenderHyperFramesOptions {
  postId: number;
  overrides?: HyperFramesVars;
}

/**
 * Scaffold a per-post HyperFrames project from an archetype template,
 * substitute variables, spawn `npx hyperframes render`, and update
 * the script_runs row (identified by runId) when done.
 *
 * Returns immediately after spawning; the caller polls script_runs.
 */
export async function startHyperFramesRender(
  runId: number,
  opts: RenderHyperFramesOptions
): Promise<void> {
  const { postId, overrides = {} } = opts;
  const admin = supabaseAdmin();

  try {
    // 1. Load post (read via admin to survive RLS changes on posts later)
    const { data: post, error } = await admin
      .from("posts")
      .select("id, brand_id, archetype, file_path, concept, caption, cta, visual_direction")
      .eq("id", postId)
      .single();
    if (error || !post) throw new Error(`post ${postId} not found`);

    const archetype = String(post.archetype || "RB").toUpperCase();
    const templateDir = path.join(PROJECT_ROOT, "hyperframes-templates", archetype);
    if (!fs.existsSync(path.join(templateDir, "index.html"))) {
      throw new Error(
        `No HyperFrames template for archetype "${archetype}". ` +
          `Expected hyperframes-templates/${archetype}/index.html`
      );
    }
    if (!fs.existsSync(path.join(templateDir, "vars.json"))) {
      throw new Error(`Template ${archetype} is missing vars.json`);
    }

    // 2. Prepare work dir — .renders/hyperframes/<postId>/
    const workRoot = path.join(
      PROJECT_ROOT,
      ".renders",
      "hyperframes",
      String(postId)
    );
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(workRoot, "assets"), { recursive: true });

    // 3. Copy config + meta so the CLI finds its config
    for (const file of ["hyperframes.json", "meta.json"]) {
      const src = path.join(templateDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(workRoot, file));
      }
    }

    // 4. Copy template starter assets
    const templateAssets = path.join(templateDir, "assets");
    if (fs.existsSync(templateAssets)) {
      for (const f of fs.readdirSync(templateAssets)) {
        fs.copyFileSync(
          path.join(templateAssets, f),
          path.join(workRoot, "assets", f)
        );
      }
    }

    // 5. Resolve variables: defaults from vars.json examples, then overrides
    const manifest = JSON.parse(
      fs.readFileSync(path.join(templateDir, "vars.json"), "utf8")
    ) as {
      variables: Record<string, { example?: string; required?: boolean }>;
    };
    const vars: HyperFramesVars = {};
    for (const [key, spec] of Object.entries(manifest.variables)) {
      const override = overrides[key];
      const fallback = spec.example ?? "";
      vars[key] = override !== undefined && override !== "" ? override : fallback;
    }

    // 6. Substitute in HTML
    const templateHtml = fs.readFileSync(
      path.join(templateDir, "index.html"),
      "utf8"
    );
    const rendered = templateHtml.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_match, key: string) => vars[key] ?? ""
    );
    fs.writeFileSync(path.join(workRoot, "index.html"), rendered);

    // 7. Spawn `npx hyperframes render`
    const child = spawn("npx", ["hyperframes", "render"], {
      cwd: workRoot,
      shell: true,
    });

    let output = "";
    child.stdout.on("data", (d: Buffer) => {
      output += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      output += d.toString();
    });

    child.on("close", async (code) => {
      const completedAt = new Date().toISOString();
      if (code !== 0) {
        await admin
          .from("script_runs")
          .update({
            status: "error",
            output: output.slice(-8000),
            completed_at: completedAt,
          })
          .eq("id", runId);
        return;
      }

      // Find newest MP4 under workRoot/renders
      const rendersDir = path.join(workRoot, "renders");
      let mp4Path: string | null = null;
      if (fs.existsSync(rendersDir)) {
        const mp4s = fs
          .readdirSync(rendersDir)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => ({
            f,
            t: fs.statSync(path.join(rendersDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.t - a.t);
        if (mp4s.length > 0) {
          mp4Path = path.join(rendersDir, mp4s[0].f);
        }
      }

      await admin
        .from("script_runs")
        .update({
          status: mp4Path ? "success" : "error",
          output: mp4Path
            ? `RENDERED: ${mp4Path}\n\n${output.slice(-4000)}`
            : `No MP4 produced.\n\n${output.slice(-8000)}`,
          completed_at: completedAt,
        })
        .eq("id", runId);
    });

    child.on("error", async (err) => {
      await admin
        .from("script_runs")
        .update({
          status: "error",
          output: `Spawn error: ${err.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("script_runs")
      .update({
        status: "error",
        output: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}

/**
 * Extract the rendered MP4 absolute path from a script_runs.output blob.
 * Returns null if not yet rendered or failed.
 */
export function parseRenderedMp4Path(output: string | null): string | null {
  if (!output) return null;
  const match = output.match(/^RENDERED: (.+)$/m);
  return match ? match[1] : null;
}
