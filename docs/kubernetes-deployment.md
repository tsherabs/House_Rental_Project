# Kubernetes CI/CD demonstration on the Ubuntu ARM64 VM

This adds a single-node K3s deployment alongside the working Docker Compose demo.
K3s is Kubernetes. It uses containerd to run Pods, so `kubectl get pods`, rather
than `docker ps`, shows this application's Kubernetes containers.

| Deployment | Browser address | Data |
| --- | --- | --- |
| Existing Compose | `http://VM_IP:8080` | Existing Docker volumes |
| New Kubernetes | `http://VM_IP:30080` | New Kubernetes persistent volumes |

Accounts, properties and photos are **not copied** between the two deployments.
They also use different session cookie names because cookies are shared across ports.
Both demos depend on the laptop and VM remaining awake and reachable on the network.

## What the pipeline does

1. A push to `kubernetes-test` runs the existing tests and image builds, plus
   deployment safeguard tests and Kubernetes schema validation.
2. Publish builds AMD64/ARM64 images and pushes commit-specific `sha-...` tags.
   This branch updates the `kubernetes-test` image tag; only `main` updates `latest`.
3. When the repository variable `ENABLE_K8S_DEPLOY` equals `true`, the successful
   publish job calls the Kubernetes CD workflow for the same commit.
4. The VM runner applies local configuration, starts/waits for PostgreSQL, runs
   a migration Job, then updates the API and web Deployments.
5. Kubernetes starts replacement Pods and waits for readiness before retiring old
   app Pods. CD waits for rollout completion and checks the frontend and API through Caddy.

A failed migration stops the application update. A failed rollout fails CD; it
does not automatically undo schema changes or guarantee that no component updated.
Migrations must stay compatible with the previously running API during rollout.

The existing Compose workflow is unchanged. Nothing is installed on your VM merely
by adding these files. Complete the setup below before enabling Kubernetes CD.

## 1. Prepare and install K3s inside the VM

Allocate at least 2 vCPUs and preferably 4–6 GB RAM for this demo; leave extra room
if Compose is running too. Check available disk space for images and database/uploads.
Use the same normal Linux user that runs your GitHub runner. Keep the runner's
existing labels: `self-hosted`, `linux`, `ARM64`, `home-finder-deploy`.

Install K3s from its official installer. These commands are for the **Ubuntu VM**,
not your Mac. Download and inspect the script before running it:

```bash
curl -fsSL https://get.k3s.io -o /tmp/install-k3s.sh
less /tmp/install-k3s.sh
sudo sh /tmp/install-k3s.sh --disable traefik --disable servicelb --secrets-encryption
sudo k3s kubectl get nodes
```

This uses the installer's stable channel. Record `sudo k3s --version` in your report.
Traefik and ServiceLB are disabled because this demo exposes Caddy directly through
a NodePort. No Ingress controller or public domain is needed. Keep the bundled
`local-path` storage provisioner enabled.

Give the runner user a **dedicated kubeconfig**, without making it world-readable:

```bash
mkdir -p "$HOME/.kube"
chmod 700 "$HOME/.kube"
sudo install -o "$USER" -g "$(id -gn)" -m 600 \
  /etc/rancher/k3s/k3s.yaml "$HOME/.kube/homefinder-k3s.yaml"
export KUBECONFIG="$HOME/.kube/homefinder-k3s.yaml"
kubectl get nodes
kubectl get storageclass local-path
python3 --version
```

This kubeconfig grants cluster administrator access: appropriate only for this
dedicated, trusted demo VM. PR jobs remain on GitHub-hosted runners. A shared or
production cluster should use a namespace-scoped deployment identity instead.
Keep kubeconfig and credentials out of Git. Refresh this copy if the K3s certificates
are renewed; do not change its localhost server address for an in-VM runner.
Export KUBECONFIG again in each new interactive terminal; CD sets it automatically.

## 2. Get the setup files and create VM-local settings

After pushing the branch from your Mac, obtain it inside the VM:

```bash
mkdir -p "$HOME/house-rental-k8s"
chmod 700 "$HOME/house-rental-k8s"
git clone --branch kubernetes-test \
  https://github.com/tsherabs/House_Rental_Project.git "$HOME/house-rental-k8s/source"
cd "$HOME/house-rental-k8s/source"
kubectl apply -f deployment/kubernetes/namespace.yaml
umask 077
nano "$HOME/house-rental-k8s/.env"
```

Use your actual repository URL if different; private repositories require GitHub
authentication. If already cloned, update that clone instead of cloning over it.
The clone is only for setup/manual commands; Actions checks out the exact deployment
commit independently.

Enter these three lines, with no quotes and no trailing slash on APP_ORIGIN:

```dotenv
POSTGRES_PASSWORD=REPLACE_WITH_FIRST_RANDOM_HEX_SECRET
SESSION_SECRET=REPLACE_WITH_SECOND_RANDOM_HEX_SECRET
APP_ORIGIN=http://172.20.10.2:30080
```

Generate each secret separately using `openssl rand -hex 32`. Use the VM's current
reachable address, obtained with `hostname -I`; the address above is an example.
This is a new database, so create new demo credentials. Once initialized, changing
POSTGRES_PASSWORD in this file alone will **not** change the database role's password.

Apply settings:

```bash
python3 scripts/kubernetes/configure.py "$HOME/house-rental-k8s/.env"
```

The script creates a ConfigMap and Secret without printing credentials or executing
the env file as shell code. It sets development mode for this private HTTP demo,
the database Service URL, and the separate cookie name. CD reapplies the settings
and restarts the API to pick up configuration changes. If the VM IP changes, edit
APP_ORIGIN and redeploy. Public hosting would require HTTPS and production settings.

## 3. Allow Kubernetes to pull from GHCR

K3s does not inherit `docker login`. Create the `ghcr-pull` Secret in this namespace.
For private images, use a GitHub personal access token (classic) with `read:packages`
and a user with read access to both packages; authorize SSO if your organization
requires it. Renew the token before expiry. Do not paste it into Git or workflow files.

In the VM's Bash terminal:

```bash
registry_config="$(mktemp -d)"
chmod 700 "$registry_config"
read -rp 'GitHub username: ' ghcr_user
read -rsp 'GHCR read token: ' ghcr_token
echo
printf '%s' "$ghcr_token" | docker --config "$registry_config" login ghcr.io \
  --username "$ghcr_user" --password-stdin
unset ghcr_token
```

Only if login succeeds, create/update the Secret and remove the temporary login:

```bash
kubectl -n homefinder-k8s create secret generic ghcr-pull \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=.dockerconfigjson="$registry_config/config.json" \
  --dry-run=client -o json | kubectl apply --server-side -f -
docker --config "$registry_config" logout ghcr.io
rm -r "$registry_config"
unset registry_config ghcr_user
```

If **both images are public**, instead create an empty registry config Secret:

```bash
kubectl -n homefinder-k8s create secret generic ghcr-pull \
  --type=kubernetes.io/dockerconfigjson \
  --from-literal=.dockerconfigjson='{"auths":{}}' \
  --dry-run=client -o json | kubectl apply --server-side -f -
```

Do not use a workflow's temporary GITHUB_TOKEN as a permanent pull credential: it
expires, and a replacement Pod may need to pull an image after the workflow ends.

## 4. Enable the branch deployment

1. Create the GitHub environment **kubernetes-vm**. If branch restrictions are
   configured, allow `kubernetes-test` (and `main` for future manual deployments).
   Optional required-reviewer protection adds an approval gate where supported.
2. Under repository **Settings → Secrets and variables → Actions → Variables**,
   create **ENABLE_K8S_DEPLOY** with value **true**. This is a repository variable,
   not an environment variable or secret, because the caller checks it before deployment.
3. Ensure the existing VM runner is online. You do not need a second runner.
4. Push a commit to `kubernetes-test`. Watch Verify → Publish → Kubernetes CD.
5. Open `http://YOUR_VM_IP:30080`. Register new demo accounts and test creating a
   property with an uploaded photo. Check login and writes, not only the homepage.

GitHub requires a manually dispatched workflow to exist on the default branch before
the Run workflow button is available. The reusable workflow call above works while
this feature remains on `kubernetes-test`; no default-branch change is needed.
After merge, manual CD is available too: select a branch whose commit images have
finished publishing. Automatic Kubernetes deployment is restricted to the test
branch. Setting ENABLE_K8S_DEPLOY to false skips future automatic CD jobs; it does
not stop the application or cancel an already running deployment.

## Kubernetes concepts in this project

| Resource | Purpose |
| --- | --- |
| Namespace `homefinder-k8s` | Groups this demo's resources |
| Deployments `api`, `web` | Maintain desired Pods and roll out app updates |
| StatefulSet `db` | Maintains one PostgreSQL instance with stable identity/storage |
| Services `api`, `db`, `web` | Stable names/routing as Pods are replaced |
| NodePort `30080` | Exposes Caddy to devices that can reach the VM |
| ConfigMap / Secret | Supply non-secret settings and credentials |
| PersistentVolumeClaims | Retain database and uploaded files across Pod replacement |
| Migration Job | Runs schema updates to completion before app deployment |
| Startup/readiness/liveness probes | Allow startup time, control traffic, detect unhealthy containers |

Caddy still serves the Angular files and forwards `/api/*` to the `api:3000`
Kubernetes Service. The API connects to PostgreSQL through `db:5432`.
The database and API are not exposed by NodePort.

## A short demonstration

In your VM, export KUBECONFIG as above, then:

```bash
kubectl -n homefinder-k8s get pods,deployments,statefulsets,services,pvc
kubectl -n homefinder-k8s get pods -w
```

Push a visible UI change to the branch. Show tests, image publishing, the migration
Job, rollout status, and the refreshed page. In a second terminal, demonstrate Pod
replacement by deleting the API Pod (this single-replica demo may briefly interrupt requests):

```bash
kubectl -n homefinder-k8s delete pod -l app=api
kubectl -n homefinder-k8s rollout status deployment/api --timeout=300s
```

Open your previously uploaded photo after replacement to demonstrate storage
persistence. Explain that the database stores metadata while the uploads PVC stores
the image files. One node is **not high availability**: shutting down the VM stops
the app. Local-path volumes survive Pods, not loss of the VM disk. Back up real data.

For an application-only rollback demonstration (only when the previous code remains
compatible with the current database schema):

```bash
kubectl -n homefinder-k8s rollout history deployment/web
kubectl -n homefinder-k8s rollout undo deployment/web
kubectl -n homefinder-k8s rollout status deployment/web --timeout=300s
```

This does not roll back the database or API; the next CD run reapplies its selected
commit. The API's shared ReadWriteOnce upload volume works for overlapping Pods on
this single node. Do not scale this design across nodes without shared/object storage.

## Troubleshooting

- **CD skipped:** set the repository variable to `true` and push to `kubernetes-test`.
- **Waiting for runner:** check all labels, especially `home-finder-deploy`.
- **Cluster access denied:** verify the kubeconfig path/user and `kubectl get nodes`.
- **ImagePullBackOff:** check that SHA was published, GHCR access, token expiry and
  the `ghcr-pull` Secret. See `kubectl -n homefinder-k8s describe pod POD_NAME`.
- **Pending Pods:** inspect events, node CPU/memory, and `local-path` storage. A PVC
  may wait for its first consumer before binding; this is expected.
- **Migration failure:** run `kubectl -n homefinder-k8s get jobs`, then
  `kubectl -n homefinder-k8s logs job/JOB_NAME`. Fix the cause before retrying CD.
- **403 on login/saving:** ensure APP_ORIGIN matches the browser origin on port 30080.
- **Browser cannot connect:** try `curl -I http://VM_IP:30080/` from your laptop;
  check VM networking, any firewall, and browser local-network permission.
- **Application error:** `kubectl -n homefinder-k8s logs deployment/api --tail=100`.

Do not delete the namespace or PVCs to troubleshoot: that can erase the demo data.
The unchanged Compose app remains available at port 8080 if you need the fallback.

## References

- [K3s installation and single-node cluster](https://docs.k3s.io/quick-start)
- [K3s cluster access and kubeconfig permissions](https://docs.k3s.io/cluster-access)
- [Kubernetes private registry credentials](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)
- [GitHub manual workflow requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
