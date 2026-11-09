#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE_BASE:?Set IMAGE_BASE}"
: "${IMAGE_TAG:?Set IMAGE_TAG}"
: "${MIGRATION_JOB:?Set a unique MIGRATION_JOB name}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
rendered="$(mktemp -d)"
trap 'rm -rf "$rendered"' EXIT
python3 "$repo_root/scripts/kubernetes/render.py" "$rendered" "$IMAGE_BASE" "$IMAGE_TAG" "$MIGRATION_JOB"
k=(kubectl -n homefinder-k8s)
kubectl get namespace homefinder-k8s > /dev/null
"${k[@]}" get secret homefinder-secrets ghcr-pull > /dev/null
"${k[@]}" get configmap homefinder-config > /dev/null
kubectl get storageclass local-path > /dev/null

# Database storage is independent of Docker Compose's volumes.
"${k[@]}" apply -f "$rendered/database.yaml"
"${k[@]}" rollout status statefulset/db --timeout=240s
"${k[@]}" apply -f "$rendered/migration.yaml"
if ! "${k[@]}" wait --for=condition=complete "job/$MIGRATION_JOB" --timeout=200s; then
  "${k[@]}" logs "job/$MIGRATION_JOB" --all-containers=true || true
  exit 1
fi
"${k[@]}" logs "job/$MIGRATION_JOB"
# Do not update the application until migration succeeds.
"${k[@]}" apply -f "$rendered/application.yaml"
# Apply alone does not restart Pods when envFrom configuration changes.
"${k[@]}" rollout restart deployment/api
"${k[@]}" rollout status deployment/api --timeout=300s
"${k[@]}" rollout status deployment/web --timeout=300s
"${k[@]}" exec -i deployment/api -- node --input-type=module < "$repo_root/scripts/kubernetes/smoke.mjs"
"${k[@]}" get pods,services,pvc
