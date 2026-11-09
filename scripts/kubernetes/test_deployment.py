"""Offline checks for configuration safety and migration-before-rollout ordering."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from configure import resources
from render import render

ROOT = Path(__file__).resolve().parents[2]
BASE = "ghcr.io/example/homefinder"
TAG = "sha-" + "a" * 40


class DeploymentTests(unittest.TestCase):
    def config(self, directory, extra=""):
        path = Path(directory) / ".env"
        path.write_text("POSTGRES_PASSWORD=" + "a" * 64 + "\nSESSION_SECRET=" + "b" * 64
                        + "\nAPP_ORIGIN=http://192.168.1.10:30080\n" + extra)
        return path

    def test_secrets_are_separate_from_config_and_cookie_is_isolated(self):
        with tempfile.TemporaryDirectory() as directory:
            secret, config = resources(self.config(directory))
            self.assertIn("@db:5432/homefinder", secret["stringData"]["DATABASE_URL"])
            self.assertNotIn("a" * 64, json.dumps(config))
            self.assertEqual(config["data"]["SESSION_COOKIE_NAME"], "homefinder.k8s.sid")

    def test_rejects_weak_duplicate_or_wrong_origin_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            for old, new in [("a" * 64, "weak"), ("b" * 64, "a" * 64),
                             (":30080", ":8080"), (":30080", ":30080/path")]:
                with self.subTest(new=new):
                    path = self.config(directory)
                    path.write_text(path.read_text().replace(old, new))
                    with self.assertRaises(ValueError):
                        resources(path)
            with self.assertRaises(ValueError):
                resources(self.config(directory, "APP_ORIGIN=http://other:30080\n"))

    def test_render_requires_commit_tags_and_cannot_inject_yaml(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            render(output, BASE, TAG, "homefinder-migrate-test")
            app = (output / "application.yaml").read_text()
            self.assertIn(BASE + "-api:" + TAG, app)
            self.assertNotIn("__API_IMAGE__", app)
            for tag in ("latest", "sha-abc", TAG + "\nkind: Secret"):
                with self.assertRaises(ValueError):
                    render(output, BASE, tag, "homefinder-migrate-test")

    def run_deploy(self, fail_migration):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            fake = path / "kubectl"
            fake.write_text("#!/usr/bin/env python3\nimport os,sys,json\n"
                            "with open(os.environ['CALL_LOG'],'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\n"
                            "if 'wait' in sys.argv and os.environ['FAIL_MIGRATION']=='1': sys.exit(1)\n")
            fake.chmod(0o755)
            log = path / "calls.jsonl"
            result = subprocess.run(["bash", str(ROOT / "scripts/kubernetes/deploy.sh")],
                                    env={**os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                                         "IMAGE_BASE": BASE, "IMAGE_TAG": TAG,
                                         "MIGRATION_JOB": "homefinder-migrate-test",
                                         "CALL_LOG": str(log), "FAIL_MIGRATION": str(int(fail_migration))},
                                    capture_output=True, text=True)
            return result, [json.loads(line) for line in log.read_text().splitlines()]

    def test_failed_migration_never_updates_application(self):
        result, calls = self.run_deploy(True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any("application.yaml" in " ".join(call) for call in calls))
        self.assertFalse(any("exec" in call for call in calls))

    def test_success_waits_for_database_migration_and_rollouts_before_smoke(self):
        result, calls = self.run_deploy(False)
        self.assertEqual(result.returncode, 0, result.stderr)
        database_ready = next(i for i, call in enumerate(calls) if "statefulset/db" in call)
        migration_ready = next(i for i, call in enumerate(calls) if "wait" in call)
        app_apply = next(i for i, call in enumerate(calls) if "application.yaml" in " ".join(call))
        web_ready = next(i for i, call in enumerate(calls) if "deployment/web" in call)
        smoke = next(i for i, call in enumerate(calls) if "exec" in call)
        self.assertLess(database_ready, migration_ready)
        self.assertLess(migration_ready, app_apply)
        self.assertLess(app_apply, web_ready)
        self.assertLess(web_ready, smoke)


if __name__ == "__main__":
    unittest.main()
