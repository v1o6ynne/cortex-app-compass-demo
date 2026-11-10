# cortex-app

Frontend for the Cortex app.

## Dev setup

1. Optional: create `.env.local` in the repo root to override the built-in
service-routing defaults or configure analytics:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CORTEX_CORE_URL=/cortex-core
CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5556
VITE_CORTEX_INFOVIZ_URL=/infoviz
INFOVIZ_PROXY_TARGET=http://127.0.0.1:5174
```

The relative Core and Cortex-Compass defaults use Vite development proxies, so Virtual Cortex and
Cortex-Compass both work when port 5173 is opened through VS Code Remote
SSH. Ports 5556 and 5174 do not need separate browser forwarding. Cortex-Compass's
development base defaults to `/infoviz/` as shown in the runbook.

2. Install the host and visualization dependencies:

```bash
npm ci
npm --prefix apps/cortex-compass ci
```

For a new checkout, use `git clone --branch IUI https://github.com/murtylab/cortex-app.git`.

3. Run Cortex-Compass and the host in separate terminals:

```bash
npm run dev:compass
# In another terminal:
npm run dev
```

For a production check:

```bash
npm run build
npm run preview
```

### Updating an existing IUI checkout

If this checkout still uses the former Cortex-Compass submodule, complete the
one-time conversion below before pulling this release. Once converted, update
the host and Cortex-Compass together:

```bash
git switch IUI
git pull --ff-only origin IUI
```

Restart `npm run dev:compass` and `npm run dev` in their separate terminals.
The Compass launcher installs its dependencies when its lockfile changes; run
`npm ci` in the host if its dependencies changed. For a built deployment, run
`npm run build` and restart the existing serving process instead.

Cortex-Compass is tracked directly in this repository, so a normal pull includes
its source and browser data. The comparison and selectivity UI use the existing
Core IUI backend and reference bundle; an already working backend configuration
can stay in place.

#### One-time conversion from the former submodule

Git can refuse to replace an initialized submodule with ordinary tracked files
because its existing contents would be overwritten. Preserve that directory in
a backup outside the Cortex App checkout before pulling the conversion. The
backup retains any local edits, environment files, dependencies, and paper
outputs; the pull installs the bundled visualization at the same app path.
From the Cortex App root on `IUI`:

```bash
compass_backup="$(mktemp -d "$(dirname "$PWD")/cortex-compass-before-embedded.XXXXXX")"
mv apps/cortex-compass "$compass_backup/cortex-compass"
git -c submodule.recurse=false pull --ff-only origin IUI
```

Keep the backup. Restore only needed local configuration or private artifacts,
not its old tracked source or `.git` file. If the backend's reference bundle was
inside the former submodule, point `CORTEX_REFERENCE_ARTIFACT_DIR` to the retained
bundle or restore that ignored bundle before restarting Core. An already external
reference bundle keeps its existing path. The frontend launcher reinstalls
dependencies as needed. Later pulls use the normal update commands above.

Analytics setup:

- GA4 is integrated in the root Vite app, not in `cortex-web-app`
- The measurement ID is read from `VITE_GA_MEASUREMENT_ID`
- Do not commit real GA keys; keep them in `.env.local`

The fROI backend and Cortex-Compass handoff URLs are configured through `.env.local`
for local development. For a public Vercel deploy, see **Public live demo** below.
After a successful fROI prediction, the fifth results section, below **3D brain
response**, offers
**Open Cortex-Compass**. It opens `/cortex-compass/?preparing=1` in a new browser
tab immediately, showing Virtual Cortex's navigation and the normal comparison
loading view. Once the temporary NSD-1000 comparison is ready, that same tab
loads its session without a separate placeholder page or reference-only preview.
The original Lab tab and all its results remain unchanged, so users
can switch between the two tabs. A blocked popup shows an error in the Lab; failed
or stale preparation closes only its pending tab. No same-tab redirect is used.
The workspace embeds the same-origin `/infoviz/?embedded=1` page without a card
border or duplicate site masthead. Only opaque session tokens cross the
handoff; model settings and image paths are not put in the URL.

Each comparison includes the selected model plus EfficientNet (`efficient_net`),
CLIP RN50 (`clip_rn50`), and VGG16 ImageNet (`vgg16_imagenet1kv1`). Duplicate models
are run only once: three models when one baseline is selected, otherwise four.
All models use the same uploaded images, Murty185 references, and NSD-1000
predictions across FFA, PPA, and EBA. The selected model opens first; the original
Lab result is unchanged. The frontend makes one sequential request per model to
the existing single-model `POST /comparison-sessions` API; it does not send
`additional_models` or require a combined-model backend response. A versioned
`multi-v1` token bundle keeps the selected model first. Cortex-Compass loads and
validates every session, checks that the sanitized image contents and reference
settings match, and remaps independent upload IDs before presenting one workspace.
The effective expiry is the earliest individual session expiry. A failed model
does not open a partial comparison. Cortex Core must support reference data for
every requested model. Changing settings or starting a new inference
while preparing a comparison discards the old handoff rather than opening stale results.
Restoring an inference-history entry also restores Cortex-Compass access for that
run and cancels any comparison still being prepared for the previous result.

## Bundled Cortex-Compass

`apps/cortex-compass` is ordinary tracked source inside Cortex App's `IUI` branch.
It was imported from
[`KruthikRavikanti/InfoViz-Prototype-Edition`](https://github.com/KruthikRavikanti/InfoViz-Prototype-Edition),
revision `8847bf97c17b3028e1bbea171a8ca8b0e96ffaa3`. That repository preserves the
earlier development history. Current Cortex-Compass changes are committed here
with the host; cloning or pulling Cortex App includes the visualization without
a second repository checkout.

`npm run build` builds the host and bundled visualization together. The host
entry is `dist/cortex-compass/index.html`; the visualization and its public data
are published under `dist/infoviz/`. `npm run preview` serves those built files
without relying on the development visualization server. The visualization build uses
its lockfile and installs its development/build dependencies when missing or stale.
`npm run build:site` is available for a host-only build.

The standalone `/infoviz/` route and existing `INFOVIZ` environment names are
unchanged. Keep the embedded URL same-origin (normally
`VITE_CORTEX_INFOVIZ_URL=/infoviz`). A deployed host still needs `/cortex-core/`
routed to the matching backend for upload comparisons; development proxies do
not configure that production route. Bundling the frontend does not change the
Core deployment.

Update the visualization in this repository and validate the combined build:

```bash
npm --prefix apps/cortex-compass test
npm run build
git add apps/cortex-compass
git commit -m "Update Cortex-Compass"
```

Private reference bundles, checkpoints, uploaded images, sessions, environment
files, and dependency directories are not part of the frontend publication.

The complete three-service startup, artifact generation, validation, and smoke-test procedure is in
[`docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md`](docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md).

The fROI inference backend uses `VITE_CORTEX_CORE_URL` first, then the optional
`VITE_SERVER_URL` alias; if neither is set, it uses `/cortex-core`. These are
public endpoint settings, not secrets. The inference API contract is unchanged.
The whole-brain service is configured separately with `VITE_CORTEX_WHOLE_BRAIN_URL`
and defaults to `http://localhost:5557`.

## Public live demo

A public site is two pieces: this frontend on Vercel, and Cortex Core on the
lab GPU machine. `npm run build` already packs Lab and Cortex-Compass into one
`dist/` (`dist/infoviz/` for the visualization). Do not run `npm run dev` or
`npm run dev:compass` as the public servers.

### Vercel (frontend)

Import the GitHub repo as a **standalone Vite** app at `/`. Do not import
`cortex-web-app` (Next.js) or `chat-api` (FastAPI).

- Production branch: **IUI** (not `vss`)
- Build command: `npm run build`
- Output directory: `dist`

`apps/cortex-compass` is ordinary tracked source on IUI, so Vercel does not
need Git submodules or a second-repo deploy key.

### Cortex Core in tmux (backend)

On the lab machine, keep Core and the tunnel in one tmux session. Create it
with `tmux new -s cortex`. Window 1:

```bash
conda activate compass
cd /research/cortex-compass/cortex-core

export CORTEX_PORT=5557
export CORTEX_HOST=0.0.0.0
export CORTEX_REFERENCE_ARTIFACT_DIR="/research/cortex-compass/reference-bundle/reference"
export CORTEX_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174,https://cortex-app-compass-demo.vercel.app"
export CORTEX_CHECKPOINT_DIR="/research/cortex-paper/cortex_best_checkpoints"
export CORTEX_BACKBONE_DIR="/research/cortex-paper/backbones"
export GRADIO_TEMP_DIR="./app_cache"
export CUDA_VISIBLE_DEVICES=1

python app.py
```

`CORTEX_REFERENCE_ARTIFACT_DIR` must be the directory that contains
`manifest.json` (not the zip and not the parent `reference-bundle/` folder).
That private bundle is not in git; copy it onto the machine separately.

`CORTEX_ALLOWED_ORIGINS` is an exact origin list (https, no trailing slash).
After the Vercel URL is known, add it here and restart `python app.py`.
Changing CORS does not require restarting Cloudflare.

Detach with `Ctrl-b` then `d`. Reattach with `tmux attach -t cortex`.

### Cloudflare tunnel

In a second tmux window (`Ctrl-b` then `c`):

```bash
cloudflared tunnel --url http://localhost:5557
```

Copy the printed `https://….trycloudflare.com` URL (no trailing slash). Quick
tunnels mint a new hostname on every restart, so leave this window running.
Restarting `python app.py` on port 5557 does **not** require restarting the
tunnel.

### Point the frontend at the tunnel

This repo's production fallbacks currently commit that URL (instead of Vercel
project env vars). Update both defaults whenever the tunnel hostname changes:

1. `assets/js/services/config.js` — the `SERVER_URL` fallback (Lab inference)
2. `apps/cortex-compass/src/services/cortexSession.ts` — `DEFAULT_CORTEX_CORE_URL` (Compass comparison)

Then push `IUI`:

```bash
git add assets/js/services/config.js apps/cortex-compass/src/services/cortexSession.ts
git commit -m "Point Core URL at the current Cloudflare tunnel"
git push origin IUI
```

Keep local `npm run dev` on `/cortex-core` by creating an untracked `.env.local`:

```bash
VITE_CORTEX_CORE_URL=/cortex-core
CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5557
```

Optional alternative: leave the code fallbacks as `/cortex-core` and set
`VITE_CORTEX_CORE_URL` in the Vercel project **Settings → Environment
Variables**, then Redeploy. `VITE_*` is inlined at build time.

Public Lab: `https://cortex-app-compass-demo.vercel.app/lab/`.

## Model pages

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`

## Brain visualization

**Lab — ROI Card.** `scripts/export_froi_surface.py` is the baker. It reads NSD subject 1’s FreeSurfer inflated surfaces, sulcal depth, and fLoc labels from a folder outside the repo, cuts one patch per fROI, and writes a GLB with `base_lh` / `base_rh` plus `roi_*` meshes. The site only loads the committed files. `subj01_froi.glb` is that script at t > 3.3. `subj01_froi_t7.glb` is the same script at t > 7. This view shows those baked patches, not model predictions. All / Selected only toggles which `roi_*` meshes are visible.

**Lab — Run Inference — 3D brain response.** It does not build a surface. It reuses the base meshes in `subj01_froi_t7.glb`. `scripts/build_subject1_prediction_mapping.py` only builds `subject1-prediction-mapping.json`: which prediction voxel lands on which vertex. The pycortex mapper, masks, and source GIFTI files stay outside the repo. The script checks that the GLB still matches those surfaces. It does not write new geometry.

The panel appears after Run Inference and only for NSD-1000 readouts, not Murty-185. It draws the selected image’s raw Subject 1 vector for the chosen fROI. Models may be trained jointly across subjects; only the API’s separated `s1` vector is shown. Voxel order is the training selection: cortical mask in z/y/x C-order, strict fLoc t > 7, then ROI-local indexing. Colors are a blue / cream / red scale fixed across the current image set and centered at zero. Gray cortex has no prediction here. A voxel is painted only when the linenn mapper gives it a positive weight on at least one surface vertex; the script does not snap it to a nearby vertex. Unmapped voxels are omitted: EBA 3/518, OFA 1/13, VWFA 6/232. FFA, FBA, PPA, OPA, and RSC map completely. Hover reports the dominant source voxel and its raw response, in native zero-based x/y/z. Changing the view does not change the predictions.

```bash
node --test assets/js/services/uploadBrainData.test.js
node --test assets/js/services/preloadedBrainData.test.js
node --test assets/js/services/uploadBrainProjection.test.js
python -B scripts/test_subject1_prediction_mapping.py -v
```

**Whole Brain.** There is no surface baker here. The current page inserts the HTML the backend returns; that code is not in this repo. Each image is scored into a voxel vector. A contrast is an ordinary two-sample t-test at every voxel: all images in group A against all images in group B. Voxel values are placed on the HCP inflated cortical surface with `hcp_utils`. nilearn’s `view_surf` draws them on `hcp.mesh.inflated`, with sulcal depth as the background, and returns a self-contained HTML widget. Changing the t threshold redraws that HTML. It does not rerun the model.
