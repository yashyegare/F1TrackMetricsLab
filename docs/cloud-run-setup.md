# Cloud Run deploy — one-time setup

The `deploy` job in `.github/workflows/ci.yml` deploys this app to Cloud Run
on every push to `main` (after tests + e2e pass). The workflow file has three
placeholders to fill in: `PROJECT_ID` (twice) and `PROJECT_NUMBER` (once).
This is the one-time Google Cloud setup behind them — paste each block in
order. Takes ~10 minutes; the only interactive step is authenticating gcloud.

```bash
export PROJECT_ID=your-project-id        # <- fill in
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export REGION=asia-south1                # <- change if you prefer another region
```

## 1. Enable APIs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com iamcredentials.googleapis.com \
  --project $PROJECT_ID
```

## 2. Service account for CI deploys

Least-privilege: `run.developer` covers `gcloud run deploy` (create/update
revisions, services). The two extra grants are the minimum the `--source .`
path additionally needs: Cloud Build submits the build, and the Cloud Build
service account must be able to act as the deployer SA when the job runs
under its identity.

```bash
gcloud iam service-accounts create f1-tml-deployer \
  --display-name "GitHub Actions deployer for Track Metrics Lab" \
  --project $PROJECT_ID

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:f1-tml-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/run.developer

# Needed because `gcloud run deploy --source .` submits a Cloud Build job.
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:f1-tml-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/cloudbuild.builds.editor

# First deploy creates the service with public ingress; later deploys only
# update revisions, which run.developer covers.
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:f1-tml-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role roles/run.serviceAgent
```

If Cloud Build has never run in the project, also grant the default build SA
the run.developer role so the built image can be deployed by the build step:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role roles/run.developer
```

## 3. Workload Identity Federation (keyless GitHub auth)

No service-account JSON keys. GitHub's OIDC token is exchanged for a short-
lived GCP token, scoped to this one repo's main branch.

```bash
gcloud iam workload-identity-pools create github-pool \
  --location global --display-name "GitHub Actions pool" \
  --project $PROJECT_ID

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location global \
  --workload-identity-pool github-pool \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-condition "assertion.repository_owner == 'yashyegare' && assertion.repository == 'yashyegare/F1TrackMetricsLab' && assertion.ref == 'refs/heads/main'" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --project $PROJECT_ID

gcloud iam service-accounts add-iam-policy-binding \
  f1-tml-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/yashyegare/F1TrackMetricsLab" \
  --project $PROJECT_ID
```

## 4. First deploy (one manual run to create the service)

The CI service account can create revisions, but the very first service
creation is easiest done once by hand — after this, CI owns every deploy:

```bash
cd <repo root>
gcloud run deploy track-metrics-lab \
  --project $PROJECT_ID --region $REGION \
  --source . \
  --allow-unauthenticated
```

When it finishes it prints the service URL — that's the app live on Cloud Run.

## 5. Workflow placeholders (filled in)

All placeholders in `.github/workflows/ci.yml` are filled in on the
docker-deploy branch: project `f1-track-metrics-lab`, service account
`f1-tml-deployer`, provider `github-pool/github-provider`, region
`asia-south1`. Pushing that branch to `main` triggers the full pipeline.

## Verify

```bash
gcloud run services describe track-metrics-lab \
  --project $PROJECT_ID --region $REGION --format='value(status.url)'
```

Every push to `main` now deploys; the GitHub Actions run history is the
deploy log. To tighten later: this setup is already least-privilege
(`run.developer`, not `run.admin`) and the WIF condition pins the repo and
branch — the only widening left is removing `--allow-unauthenticated` behind
an LB/IAP if this ever stops being a public demo.

## Addendum — grants actually used by the first deploy (verified live)

The first `--source` deploy needed four grants beyond the list above. Each
was verified by running a full deploy under the service account's own
identity (via local impersonation) before CI ever ran:

| Grant | Scope | Why |
|---|---|---|
| `roles/artifactregistry.writer` | repo `cloud-run-source-deploy` (asia-south1) only | source upload pushes the built image there |
| `roles/iam.serviceAccountUser` | on `859763063159-compute@developer.gserviceaccount.com` only | the build must run as the default Cloud Build SA |
| `roles/storage.objectAdmin` + `roles/storage.legacyBucketReader` | bucket `run-sources-f1-track-metrics-lab-asia-south1` only | staging bucket for the uploaded source zip. An initial `storage.admin` grant was proven broader than needed: it was revoked and a full deploy still succeeded — verified by a 403 on `storage.buckets.getIamPolicy` under the deployer identity, a permission only the broader role carries. Do not re-widen. |
| `roles/storage.viewer` | project | gcloud lists buckets to resolve that staging bucket |
| `roles/iam.serviceAccountTokenCreator` | on `f1-tml-deployer`, user member only | lets you impersonate the SA locally to test deploys; not needed by CI |

Known benign CI warning: `Setting IAM policy failed ...` — the deployer
cannot set IAM policy (`run.developer` deliberately excludes it) and does
not need to: the service was made public by the first manual deploy, so
`--allow-unauthenticated` is a no-op on every later deploy. If the service
ever goes private, the smoke test fails loudly by design — update the
smoke-test step in the same change.
