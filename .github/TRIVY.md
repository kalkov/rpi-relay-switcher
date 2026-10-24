# Trivy security checks

The `Trivy Security` workflow scans the repository on pull requests, pushes to
the default branch, a staggered weekly schedule, and manual dispatch. It uses
Trivy 0.76.1 with a verified release checksum and read-only repository access.

Source scans check supported dependency manifests/lockfiles and infrastructure
configuration (including Dockerfiles, Kubernetes and Terraform). Container
scans check OS and application packages. Secret and license scanning are not
enabled. An unsupported dependency format or missing lockfile can leave gaps;
a successful scan is not proof that every dependency was identified.

All severities are retained in a JSON Actions artifact for seven days. HIGH and
CRITICAL findings fail the job, including vulnerabilities without a fix. Scanner
or database failures also fail the job. No blanket exceptions are introduced.
Review findings before adding any narrowly scoped, documented exception.

For image-publishing repositories, publishing jobs scan the exact pushed digest
before subsequent steps or dependent deployment jobs can run. Images are already
in the registry at scan time; external consumers of mutable tags are not gated.
Weekly/manual image jobs rescan the configured release tags, which are not
necessarily the digests currently deployed. Existing branch-protection rules
are unchanged; requiring `Trivy Security` for merges is a separate setting.

Run manually from Actions → Trivy Security → Run workflow. To reproduce a source
scan locally with the pinned Trivy installed:

```sh
trivy fs --scanners vuln,misconfig --skip-dirs .git --format json --output /tmp/trivy-results.json .
trivy convert --format table --severity HIGH,CRITICAL --exit-code 1 /tmp/trivy-results.json
```

Trivy requires no paid subscription. GitHub-hosted execution and artifact storage
use the repository owner's GitHub Actions allowance. This workflow does not
require GitHub Advanced Security or upload to GitHub code scanning.
