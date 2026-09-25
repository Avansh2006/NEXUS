# Dedicated Azure test VM

Created for NEXUS on 2026-09-23 at the user's request.

| Setting | Value |
| --- | --- |
| Branch | `feat/deva` |
| Azure account | Animesh's signed-in Azure subscription |
| Subscription ID | `84eabcd2-fd2b-4411-a2f4-71bd375fecb1` |
| Resource group | `nexus-deva-test-rg` |
| VM | `nexus-deva-test-vm` |
| Region | Central India |
| Size | `Standard_B2as_v2` (2 vCPUs, 8 GB RAM) |
| OS | Ubuntu 24.04 LTS |
| OS disk | 64 GB Standard SSD |
| SSH user | `nexus` |
| Public IP | `74.225.149.7` |
| Remote checkout | `/home/nexus/NEXUS` |
| Compose project | `nexus-deva-test` |

The original B2ms size was unavailable; Azure successfully provisioned B2as v2.
The SSH network rule permits only the provisioning client's public IP. If that
IP changes, update the `SSH-from-test-client` rule in `nexus-deva-test-nsg` to
the new single-client CIDR. Do not expose application or debugger ports.

The generated SSH key and known-host entry are in ignored `.tools/azure/`.
They are local machine state and must not be committed or shared. Cloud-init
configuration is in `scripts/azure-test-bootstrap.yaml`.

## Connect and inspect

From the repository root in PowerShell:

```powershell
ssh -i .tools/azure/nexus-deva-test -o UserKnownHostsFile=.tools/azure/known_hosts -L 8080:127.0.0.1:8080 nexus@74.225.149.7
```

After the stack is healthy, open `http://localhost:8080`. Use another local
port in the first part of `-L` if local port 8080 is occupied, and account for
the configured frontend origin when using that port.

## Run verification

On the VM:

```bash
cd /home/nexus/NEXUS
bash scripts/test-azure.sh
```

The runner uses versioned container runtimes for Python 3.12, Java 17/Maven,
Node 22, and Playwright. It writes each stage's exit code to
`artifacts/azure/results.tsv`, with separate logs, Python JUnit output, Compose
status, and service logs. Browser screenshots, recordings, and report are stored
under `artifacts/`. It continues independent tests after a failure but returns
a failing overall exit code. The PostgreSQL-backed stack stays running for
inspection. Test credentials are generated in ignored `.tools/azure/test.env`.
The account/password list is in private `.tools/azure/credentials.json` on the VM;
the final verification also copies that file to the same ignored local path.

Record the uploaded Git commit or immutable source archive SHA-256 in
`artifacts/azure/source-revision.txt` and retain the source archive locally.
See [completion results](AZURE_COMPLETION_RESULTS.md) for the final feature run;
the earlier baseline report describes the original application only.

## Cost and shutdown

Daily shutdown is enabled at 18:30 UTC (midnight India time), verified through
the Azure schedule resource after creation. Manually deallocate when finished:

```powershell
az vm deallocate --subscription 84eabcd2-fd2b-4411-a2f4-71bd375fecb1 --resource-group nexus-deva-test-rg --name nexus-deva-test-vm
```

Restart with `az vm start` using the same subscription/resource-group/name.
Deallocation stops VM compute charges; the disk and public IP can still incur
charges. This resource group is dedicated to this task; do not delete unrelated
resources or stop existing VMs. Destruction of this test group also removes its
database and uncollected results.
