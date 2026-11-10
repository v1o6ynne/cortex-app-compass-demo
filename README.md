# cortex-app

Frontend for the Cortex app. Cortex-Compass lives in `apps/cortex-compass` in
this same repository.

## Dev setup

Local demo is three processes: Cortex Core, Compass, and the Lab host.

1. Optional: create `.env.local` in the repo root to point the Lab at local
Core, or to configure analytics:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CORTEX_CORE_URL=/cortex-core
CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5557
```

`VITE_CORTEX_CORE_URL=/cortex-core` uses Vite's local Core proxy. That is
needed here because the committed production fallback is the Cloudflare URL.
`CORTEX_CORE_PROXY_TARGET` must match Core's `CORTEX_PORT`; use 5557 when
5556 is already taken. Forward only port 5173 through VS Code Remote SSH.

2. Install dependencies. Vite 6 needs **Node 18+** (Node 20 is fine). On this
lab machine, `conda activate compass` already has Node 20; the system Node 10
install will fail `npm run dev`.

```bash
conda activate compass
npm ci
npm --prefix apps/cortex-compass ci
```

For a new checkout, use `git clone --branch IUI https://github.com/murtylab/cortex-app.git`
(or this demo fork: `https://github.com/v1o6ynne/cortex-app-compass-demo.git`).

3. Start Cortex Core before the two Vite apps. Lab inference and Compass
comparisons both call this process. The private reference bundle is not in git;
point `CORTEX_REFERENCE_ARTIFACT_DIR` at the unzipped directory that contains
`manifest.json` (not the zip, not the parent folder).

```bash
conda activate compass
cd /research/cortex-compass/cortex-core

export CORTEX_PORT=5557
export CORTEX_HOST=0.0.0.0
export CORTEX_REFERENCE_ARTIFACT_DIR="/research/cortex-compass/reference-bundle/reference"
export CORTEX_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
export CORTEX_CHECKPOINT_DIR="/research/cortex-paper/cortex_best_checkpoints"
export CORTEX_BACKBONE_DIR="/research/cortex-paper/backbones"
export GRADIO_TEMP_DIR="./app_cache"
export CUDA_VISIBLE_DEVICES=1

python app.py
```

4. Run Compass and the Lab host in two more terminals:

```bash
conda activate compass
npm run dev:compass
# In another terminal:
conda activate compass
npm run dev
```

Open the Lab at `http://localhost:5173/lab/`. After inference, **Open
Cortex-Compass** opens `/cortex-compass/` in a new tab on that same origin.

For a production check:

```bash
npm run build
npm run preview
```

### Updating an existing IUI checkout

```bash
git switch IUI
git pull --ff-only origin IUI
```

Restart `npm run dev:compass` and `npm run dev`. Run `npm ci` in the host (and
`npm --prefix apps/cortex-compass ci` if Compass dependencies changed). For a
built deployment, run `npm run build` and restart the serving process.

Analytics setup:

- GA4 is integrated in the root Vite app, not in `cortex-web-app`
- The measurement ID is read from `VITE_GA_MEASUREMENT_ID`
- Do not commit real GA keys; keep them in `.env.local`

Local Lab inference uses `.env.local` only for Core (`VITE_CORTEX_CORE_URL` and
the proxy target). For a public Vercel deploy, see **Public live demo** below.
After a successful fROI prediction, the fifth results section, below **3D brain
response**, offers
**Open Cortex-Compass**. It opens `/cortex-compass/?preparing=1` in a new browser
tab immediately, showing Virtual Cortex's navigation and the normal comparison
loading view. Once the temporary NSD-1000 comparison is ready, that same tab
loads its session without a separate placeholder page or reference-only preview.
The original Lab tab and all its results remain unchanged, so users
can switch between the two tabs. A blocked popup shows an error in the Lab; failed
or stale preparation closes only its pending tab. No same-tab redirect is used.
Only opaque session tokens cross the handoff; model settings and image paths
are not put in the URL.

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

## Cortex-Compass

`apps/cortex-compass` is ordinary tracked source on the `IUI` branch. Clone or
pull this repo and it is already there. `npm run build` builds the host and
Compass together into `dist/`. `npm run preview` serves that combined build.
`npm run build:site` is available for a host-only build.

A deployed host still needs Core reachable for upload comparisons (the
committed Cloudflare fallback, or a production `/cortex-core/` route).
Development proxies do not configure that production route.

Update Compass in this repository and validate the combined build:

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
`VITE_SERVER_URL` alias. If neither is set, it uses the committed Cloudflare
fallback in `assets/js/services/config.js`. These are public endpoint settings,
not secrets. The inference API contract is unchanged. The whole-brain service
is configured separately with `VITE_CORTEX_WHOLE_BRAIN_URL` and defaults to
`http://localhost:5557`.

## Public live demo

A public site is two pieces: this frontend on Vercel, and Cortex Core on the
lab GPU machine. `npm run build` packs Lab and Compass into one `dist/`. Do
not run `npm run dev` or `npm run dev:compass` as the public servers.

### Vercel (frontend)

Import the GitHub repo as a **standalone Vite** app at `/`. Do not import
`cortex-web-app` (Next.js) or `chat-api` (FastAPI).

- Production branch: **IUI** (not `vss`)
- Build command: `npm run build`
- Output directory: `dist`

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
